package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/cresdynamics-lang/CresOs/apps/developer-go/internal/auth"
	"github.com/cresdynamics-lang/CresOs/apps/developer-go/internal/config"
	"github.com/cresdynamics-lang/CresOs/apps/developer-go/internal/store"
	"github.com/cresdynamics-lang/CresOs/apps/developer-go/internal/web"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	loadDotEnv(".env")
	cfg := config.Load()

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("db ping: %v", err)
	}

	authSvc := &auth.Service{DB: pool, JWTSecret: []byte(cfg.JWTSecret)}
	st := &store.Store{DB: pool}
	srv, err := web.NewServer(cfg, authSvc, st)
	if err != nil {
		log.Fatalf("templates: %v", err)
	}

	httpSrv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           logRequests(srv.Routes()),
		ReadHeaderTimeout: 10 * time.Second,
	}
	log.Printf("cresos developer-go listening on http://localhost:%s", cfg.Port)
	log.Fatal(httpSrv.ListenAndServe())
}

func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start))
	})
}

func loadDotEnv(path string) {
	b, err := os.ReadFile(path)
	if err != nil {
		return
	}
	for _, line := range strings.Split(string(b), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		k, v, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		k = strings.TrimSpace(k)
		v = strings.TrimSpace(v)
		if os.Getenv(k) == "" {
			_ = os.Setenv(k, v)
		}
	}
}
