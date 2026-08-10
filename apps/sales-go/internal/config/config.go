package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port         string
	DatabaseURL  string
	JWTSecret    string
	CookieName   string
	AppName      string
	SecureCookie bool
}

func Load() Config {
	return Config{
		Port:         getenv("PORT", "4100"),
		DatabaseURL:  getenv("DATABASE_URL", "postgresql://cresos:cresos@localhost:5435/cresos"),
		JWTSecret:    getenv("JWT_SECRET", "dev-secret"),
		CookieName:   getenv("COOKIE_NAME", "cresos_sales_token"),
		AppName:      getenv("APP_NAME", "CresOS Sales"),
		SecureCookie: getenv("SECURE_COOKIE", "false") == "true",
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
