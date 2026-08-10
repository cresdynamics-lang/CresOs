package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Port         string
	DatabaseURL  string
	JWTSecret    string
	CookieName   string
	AppName      string
	SecureCookie bool
	// BasePath is the public URL prefix (e.g. "/w/sales"). Empty for local root.
	BasePath string
	// PublicWebURL is the Next.js origin for deep links (AI planner, etc.).
	PublicWebURL string
}

func Load() Config {
	base := strings.TrimRight(getenv("BASE_PATH", ""), "/")
	return Config{
		Port:         getenv("PORT", "4100"),
		DatabaseURL:  getenv("DATABASE_URL", "postgresql://cresos:cresos@localhost:5435/cresos"),
		JWTSecret:    getenv("JWT_SECRET", "dev-secret"),
		CookieName:   getenv("COOKIE_NAME", "cresos_sales_token"),
		AppName:      getenv("APP_NAME", "CresOS Sales"),
		SecureCookie: getenv("SECURE_COOKIE", "false") == "true",
		BasePath:     base,
		PublicWebURL: strings.TrimRight(getenv("PUBLIC_WEB_URL", ""), "/"),
	}
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func (c Config) PortInt() int {
	n, err := strconv.Atoi(c.Port)
	if err != nil {
		return 4100
	}
	return n
}

// Path joins BasePath with a relative app path (may include query string).
func (c Config) Path(parts ...string) string {
	p := strings.Join(parts, "")
	if p == "" {
		p = "/"
	}
	q := ""
	if i := strings.IndexByte(p, '?'); i >= 0 {
		q = p[i:]
		p = p[:i]
	}
	if !strings.HasPrefix(p, "/") {
		p = "/" + p
	}
	if c.BasePath == "" {
		return p + q
	}
	if p == "/" {
		return c.BasePath + "/" + q
	}
	return c.BasePath + p + q
}

func (c Config) CookiePath() string {
	if c.BasePath == "" {
		return "/"
	}
	return c.BasePath
}
