package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/lucsky/cuid"
	"golang.org/x/crypto/bcrypt"
)

type Claims struct {
	UserID    string   `json:"userId"`
	OrgID     string   `json:"orgId"`
	RoleKeys  []string `json:"roleKeys"`
	SessionID string   `json:"sessionId"`
	jwt.RegisteredClaims
}

type User struct {
	ID       string
	Email    string
	Name     string
	OrgID    string
	RoleKeys []string
}

type Service struct {
	DB        *pgxpool.Pool
	JWTSecret []byte
}

func (s *Service) Login(ctx context.Context, email, password, ip, ua string) (token string, user User, err error) {
	email = strings.TrimSpace(strings.ToLower(email))
	var (
		id, hash, name string
		orgID          *string
		status         string
		deletedAt      *time.Time
	)
	err = s.DB.QueryRow(ctx, `
		SELECT id, "passwordHash", COALESCE(name, ''), "orgId", status, "deletedAt"
		FROM "User"
		WHERE lower(email) = $1
		LIMIT 1
	`, email).Scan(&id, &hash, &name, &orgID, &status, &deletedAt)
	if err != nil {
		return "", User{}, errors.New("invalid email or password")
	}
	if deletedAt != nil || status != "active" {
		return "", User{}, errors.New("user is not active")
	}
	if orgID == nil || *orgID == "" {
		return "", User{}, errors.New("user has no organisation")
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) != nil {
		return "", User{}, errors.New("invalid email or password")
	}

	roles, err := s.loadRoles(ctx, id)
	if err != nil {
		return "", User{}, err
	}
	if !hasSalesAccess(roles) {
		return "", User{}, errors.New("sales workspace access required")
	}

	sessionID := cuid.New()
	_, err = s.DB.Exec(ctx, `
		INSERT INTO "Session" (id, "orgId", "userId", "createdAt", "lastSeenAt", ip, "userAgent")
		VALUES ($1, $2, $3, NOW(), NOW(), $4, $5)
	`, sessionID, *orgID, id, nullStr(ip), nullStr(ua))
	if err != nil {
		return "", User{}, fmt.Errorf("create session: %w", err)
	}

	claims := Claims{
		UserID:    id,
		OrgID:     *orgID,
		RoleKeys:  roles,
		SessionID: sessionID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := t.SignedString(s.JWTSecret)
	if err != nil {
		return "", User{}, err
	}

	user = User{ID: id, Email: email, Name: name, OrgID: *orgID, RoleKeys: roles}
	return signed, user, nil
}

func (s *Service) ParseAndValidate(ctx context.Context, tokenStr string) (*Claims, error) {
	parsed, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (any, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, errors.New("unexpected signing method")
		}
		return s.JWTSecret, nil
	})
	if err != nil || !parsed.Valid {
		return nil, errors.New("invalid token")
	}
	claims, ok := parsed.Claims.(*Claims)
	if !ok || claims.SessionID == "" {
		return nil, errors.New("invalid session")
	}

	var revoked *time.Time
	var userStatus string
	var deletedAt *time.Time
	err = s.DB.QueryRow(ctx, `
		SELECT s."revokedAt", u.status, u."deletedAt"
		FROM "Session" s
		JOIN "User" u ON u.id = s."userId"
		WHERE s.id = $1
	`, claims.SessionID).Scan(&revoked, &userStatus, &deletedAt)
	if err != nil || revoked != nil || deletedAt != nil || userStatus != "active" {
		return nil, errors.New("session revoked")
	}
	_, _ = s.DB.Exec(ctx, `UPDATE "Session" SET "lastSeenAt" = NOW() WHERE id = $1`, claims.SessionID)
	return claims, nil
}

func (s *Service) RevokeSession(ctx context.Context, sessionID string) {
	_, _ = s.DB.Exec(ctx, `UPDATE "Session" SET "revokedAt" = NOW() WHERE id = $1`, sessionID)
}

func (s *Service) loadRoles(ctx context.Context, userID string) ([]string, error) {
	rows, err := s.DB.Query(ctx, `
		SELECT r.key
		FROM "UserRole" ur
		JOIN "Role" r ON r.id = ur."roleId"
		WHERE ur."userId" = $1
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var keys []string
	for rows.Next() {
		var k string
		if err := rows.Scan(&k); err != nil {
			return nil, err
		}
		keys = append(keys, k)
	}
	return keys, rows.Err()
}

func hasSalesAccess(roles []string) bool {
	allowed := map[string]bool{
		"admin": true, "sales": true, "director_admin": true, "finance": true, "analyst": true,
	}
	for _, r := range roles {
		if allowed[r] {
			return true
		}
	}
	return false
}

func HasRole(roles []string, key string) bool {
	for _, r := range roles {
		if r == key {
			return true
		}
	}
	return false
}

func IsAdmin(roles []string) bool { return HasRole(roles, "admin") }

// IsLeadership can see org-wide collection tasks (admin / finance / director).
func IsLeadership(roles []string) bool {
	return HasRole(roles, "admin") || HasRole(roles, "finance") || HasRole(roles, "director_admin")
}

func nullStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func DisplayName(name, email string) string {
	name = strings.TrimSpace(name)
	if name != "" {
		parts := strings.Fields(name)
		return parts[0]
	}
	local := strings.Split(email, "@")[0]
	if local == "" {
		return "there"
	}
	return strings.ToUpper(local[:1]) + local[1:]
}
