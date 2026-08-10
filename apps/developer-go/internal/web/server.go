package web

import (
	"context"
	"embed"
	"fmt"
	"html/template"
	"io/fs"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/cresdynamics-lang/CresOs/apps/developer-go/internal/auth"
	"github.com/cresdynamics-lang/CresOs/apps/developer-go/internal/config"
	"github.com/cresdynamics-lang/CresOs/apps/developer-go/internal/store"
)

//go:embed templates/*.html static/*
var assets embed.FS

type Server struct {
	Cfg   config.Config
	Auth  *auth.Service
	Store *store.Store
	Tmpl  *template.Template
}

type ctxKey int

const claimsKey ctxKey = 1

func NewServer(cfg config.Config, a *auth.Service, st *store.Store) (*Server, error) {
	funcMap := template.FuncMap{
		"date": func(t time.Time) string {
			if t.IsZero() {
				return "—"
			}
			return t.Format("2 Jan 2006")
		},
		"datep": func(t *time.Time) string {
			if t == nil || t.IsZero() {
				return "—"
			}
			return t.Format("2 Jan 2006")
		},
		"initials": auth.Initials,
		"pct": func(part, total int) int {
			if total <= 0 {
				return 0
			}
			return (part * 100) / total
		},
		"sumSlices": func(slices []store.ChartSlice) int {
			n := 0
			for _, s := range slices {
				n += s.Value
			}
			return n
		},
		"pieConic": func(slices []store.ChartSlice) template.CSS {
			colors := []string{"#ff6b00", "#22c55e", "#3b82f6", "#ef4444", "#eab308", "#7c5cfc"}
			total := 0
			for _, s := range slices {
				total += s.Value
			}
			if total <= 0 {
				return template.CSS("conic-gradient(#efeae3 0 100%)")
			}
			var b strings.Builder
			b.WriteString("conic-gradient(")
			acc := 0
			for i, s := range slices {
				start := float64(acc) / float64(total) * 100
				acc += s.Value
				end := float64(acc) / float64(total) * 100
				if i > 0 {
					b.WriteString(", ")
				}
				fmt.Fprintf(&b, "%s %.2f%% %.2f%%", colors[i%len(colors)], start, end)
			}
			b.WriteString(")")
			return template.CSS(b.String())
		},
		"statusClass": func(label string) string {
			switch strings.ToLower(label) {
			case "completed", "approved", "ok", "accepted", "done", "active":
				return "st-ok"
			case "delayed", "warn", "to do", "viewed", "pending", "paused", "planned":
				return "st-warn"
			case "at risk", "in review", "bad", "blocked", "declined", "cancelled":
				return "st-bad"
			case "on going", "orange", "in progress", "waiting":
				return "st-orange"
			default:
				return "st-neutral"
			}
		},
		"progressDeg": func(pct int) int {
			if pct < 0 {
				return 0
			}
			if pct > 100 {
				return 180
			}
			return int(float64(pct) / 100 * 180)
		},
		"repeat": func(n int) []struct{} {
			if n < 0 {
				n = 0
			}
			if n > 24 {
				n = 24
			}
			return make([]struct{}, n)
		},
		"add": func(a, b int) int { return a + b },
		"trunc": func(s string, n int) string {
			r := []rune(s)
			if len(r) <= n {
				return s
			}
			return string(r[:n]) + "…"
		},
	}
	tmpl, err := template.New("").Funcs(funcMap).ParseFS(assets, "templates/*.html")
	if err != nil {
		return nil, err
	}
	return &Server{Cfg: cfg, Auth: a, Store: st, Tmpl: tmpl}, nil
}

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	staticFS, err := fs.Sub(assets, "static")
	if err == nil {
		mux.Handle("GET /static/", http.StripPrefix("/static/", http.FileServer(http.FS(staticFS))))
	}
	mux.HandleFunc("GET /login", s.handleLoginGet)
	mux.HandleFunc("POST /login", s.handleLoginPost)
	mux.HandleFunc("GET /sso", s.handleSSO)
	mux.HandleFunc("POST /logout", s.withAuth(s.handleLogout))
	mux.HandleFunc("GET /", s.withAuth(s.handleDashboard))
	mux.HandleFunc("GET /projects", s.withAuth(s.handleProjects))
	mux.HandleFunc("GET /projects/{id}", s.withAuth(s.handleProjectDetail))
	mux.HandleFunc("POST /projects/assignments/{id}/respond", s.withAuth(s.handleAssignmentRespond))
	mux.HandleFunc("GET /tasks", s.withAuth(s.handleTasks))
	mux.HandleFunc("POST /tasks/{id}/status", s.withAuth(s.handleTaskStatus))
	mux.HandleFunc("POST /tasks/{id}/comments", s.withAuth(s.handleTaskComment))
	mux.HandleFunc("GET /schedule", s.withAuth(s.handleSchedule))
	mux.HandleFunc("POST /schedule/{id}/complete", s.withAuth(s.handleScheduleComplete))
	mux.HandleFunc("GET /reports", s.withAuth(s.handleReports))
	mux.HandleFunc("POST /reports", s.withAuth(s.handleReportCreate))
	mux.HandleFunc("GET /payments", s.withAuth(s.handlePayments))
	mux.HandleFunc("POST /payments/{id}/ack", s.withAuth(s.handlePaymentAck))
	mux.HandleFunc("POST /reminders/snooze", s.withAuth(s.handleReminderSnooze))
	mux.HandleFunc("GET /performance", s.withAuth(s.handlePerformance))
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true,"app":"developer-go"}`))
	})
	return mux
}

func (s *Server) withAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		c, err := r.Cookie(s.Cfg.CookieName)
		token := ""
		if err == nil {
			token = c.Value
		}
		if token == "" {
			http.Redirect(w, r, "/login", http.StatusSeeOther)
			return
		}
		claims, err := s.Auth.ParseAndValidate(r.Context(), token)
		if err != nil {
			http.SetCookie(w, &http.Cookie{Name: s.Cfg.CookieName, Value: "", Path: "/", MaxAge: -1})
			http.Redirect(w, r, "/login", http.StatusSeeOther)
			return
		}
		if !auth.HasDeveloperAccess(claims.RoleKeys) {
			http.Error(w, "developer workspace access required", http.StatusForbidden)
			return
		}
		ctx := context.WithValue(r.Context(), claimsKey, claims)
		next(w, r.WithContext(ctx))
	}
}

func claimsFrom(r *http.Request) *auth.Claims {
	c, _ := r.Context().Value(claimsKey).(*auth.Claims)
	return c
}

type pageData struct {
	AppName     string
	Title       string
	Nav         string
	UserName    string
	UserEmail   string
	UserTitle   string
	UserInitial string
	Flash       string
	Error       string
	Data        any
}

func (s *Server) render(w http.ResponseWriter, name string, data pageData) {
	data.AppName = s.Cfg.AppName
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := s.Tmpl.ExecuteTemplate(w, name, data); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (s *Server) basePage(r *http.Request, title, nav string) pageData {
	c := claimsFrom(r)
	name, email, titleJob, _ := s.Store.UserProfile(r.Context(), c.UserID)
	if name == "" {
		name = auth.DisplayName("", email)
	}
	return pageData{
		Title:       title,
		Nav:         nav,
		UserName:    name,
		UserEmail:   email,
		UserTitle:   titleJob,
		UserInitial: auth.Initials(name, email),
	}
}

func (s *Server) handleLoginGet(w http.ResponseWriter, r *http.Request) {
	p := pageData{Title: "Sign in"}
	if r.URL.Query().Get("err") == "sso" {
		p.Error = "Session handoff failed — sign in again."
	}
	s.render(w, "login.html", p)
}

func (s *Server) handleLoginPost(w http.ResponseWriter, r *http.Request) {
	_ = r.ParseForm()
	token, user, err := s.Auth.Login(r.Context(), r.FormValue("email"), r.FormValue("password"), r.RemoteAddr, r.UserAgent())
	if err != nil {
		s.render(w, "login.html", pageData{Title: "Sign in", Error: err.Error()})
		return
	}
	_ = user
	http.SetCookie(w, &http.Cookie{
		Name: s.Cfg.CookieName, Value: token, Path: "/", HttpOnly: true,
		SameSite: http.SameSiteLaxMode, Secure: s.Cfg.SecureCookie, MaxAge: 3600,
	})
	http.Redirect(w, r, "/", http.StatusSeeOther)
}

func (s *Server) handleSSO(w http.ResponseWriter, r *http.Request) {
	token := strings.TrimSpace(r.URL.Query().Get("token"))
	if token == "" {
		http.Redirect(w, r, "/login", http.StatusSeeOther)
		return
	}
	claims, err := s.Auth.ParseAndValidate(r.Context(), token)
	if err != nil || !auth.HasDeveloperAccess(claims.RoleKeys) {
		http.Redirect(w, r, "/login?err=sso", http.StatusSeeOther)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name: s.Cfg.CookieName, Value: token, Path: "/", HttpOnly: true,
		SameSite: http.SameSiteLaxMode, Secure: s.Cfg.SecureCookie, MaxAge: 3600,
	})
	next := r.URL.Query().Get("next")
	if next == "" || !strings.HasPrefix(next, "/") || strings.HasPrefix(next, "//") {
		next = "/"
	}
	http.Redirect(w, r, next, http.StatusSeeOther)
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	if c := claimsFrom(r); c != nil {
		s.Auth.RevokeSession(r.Context(), c.SessionID)
	}
	http.SetCookie(w, &http.Cookie{Name: s.Cfg.CookieName, Value: "", Path: "/", MaxAge: -1})
	http.Redirect(w, r, "/login", http.StatusSeeOther)
}

func (s *Server) handleDashboard(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	d, err := s.Store.Dashboard(r.Context(), c.OrgID, c.UserID)
	p := s.basePage(r, "Dashboard", "dashboard")
	if err != nil {
		p.Error = err.Error()
	} else {
		p.Data = d
	}
	if r.URL.Query().Get("ok") == "snooze" {
		p.Flash = "Reminder snoozed."
	}
	s.render(w, "dashboard.html", p)
}

func (s *Server) handleProjects(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	rows, err := s.Store.ListProjectSummaries(r.Context(), c.OrgID, c.UserID, 50)
	p := s.basePage(r, "Projects", "projects")
	if err != nil {
		p.Error = err.Error()
	} else {
		p.Data = rows
	}
	if r.URL.Query().Get("ok") != "" {
		p.Flash = "Assignment updated."
	}
	if e := r.URL.Query().Get("err"); e != "" {
		p.Error = e
	}
	s.render(w, "projects.html", p)
}

func (s *Server) handleProjectDetail(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	d, err := s.Store.GetProjectDetail(r.Context(), c.OrgID, c.UserID, r.PathValue("id"))
	p := s.basePage(r, "Project", "projects")
	if err != nil {
		p.Error = err.Error()
	} else {
		p.Data = d
	}
	s.render(w, "project-detail.html", p)
}

func (s *Server) handleAssignmentRespond(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	_ = r.ParseForm()
	accept := r.FormValue("accept") != "0"
	err := s.Store.RespondAssignment(r.Context(), c.OrgID, c.UserID, r.PathValue("id"), accept)
	if err != nil {
		http.Redirect(w, r, "/projects?err="+url.QueryEscape(err.Error()), http.StatusSeeOther)
		return
	}
	http.Redirect(w, r, "/projects?ok=1", http.StatusSeeOther)
}

func (s *Server) handleTasks(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	rows, err := s.Store.ListDeveloperTasks(r.Context(), c.OrgID, c.UserID, 100)
	p := s.basePage(r, "Tasks", "tasks")
	if err != nil {
		p.Error = err.Error()
	} else {
		p.Data = rows
	}
	if r.URL.Query().Get("ok") == "1" {
		p.Flash = "Task updated."
	}
	if r.URL.Query().Get("err") != "" {
		p.Error = "Could not update task — blocked reason required when marking blocked, or you need project access."
	}
	s.render(w, "tasks.html", p)
}

func (s *Server) handleTaskStatus(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	_ = r.ParseForm()
	err := s.Store.UpdateTaskStatusFull(r.Context(), c.OrgID, c.UserID, r.PathValue("id"), r.FormValue("status"), r.FormValue("blockedReason"))
	if err != nil {
		http.Redirect(w, r, "/tasks?err=1", http.StatusSeeOther)
		return
	}
	http.Redirect(w, r, "/tasks?ok=1", http.StatusSeeOther)
}

func (s *Server) handleTaskComment(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	_ = r.ParseForm()
	err := s.Store.AddTaskComment(r.Context(), c.OrgID, c.UserID, r.PathValue("id"), r.FormValue("body"), r.FormValue("type"))
	if err != nil {
		http.Redirect(w, r, "/tasks?err=1", http.StatusSeeOther)
		return
	}
	http.Redirect(w, r, "/tasks?ok=1", http.StatusSeeOther)
}

func (s *Server) handlePayments(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	rows, err := s.Store.ListPendingPayments(r.Context(), c.OrgID, c.UserID)
	p := s.basePage(r, "Payments", "payments")
	if err != nil {
		p.Error = err.Error()
	} else {
		p.Data = rows
	}
	if r.URL.Query().Get("ok") == "1" {
		p.Flash = "Payment acknowledged."
	}
	if r.URL.Query().Get("err") != "" {
		p.Error = "Could not acknowledge payment."
	}
	s.render(w, "payments.html", p)
}

func (s *Server) handlePaymentAck(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	err := s.Store.AcknowledgePayment(r.Context(), c.OrgID, c.UserID, r.PathValue("id"))
	if err != nil {
		http.Redirect(w, r, "/payments?err=1", http.StatusSeeOther)
		return
	}
	http.Redirect(w, r, "/payments?ok=1", http.StatusSeeOther)
}

func (s *Server) handleReminderSnooze(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	_ = r.ParseForm()
	until := time.Now().Add(30 * time.Minute)
	switch r.FormValue("preset") {
	case "1h":
		until = time.Now().Add(time.Hour)
	case "12h":
		until = time.Now().Add(12 * time.Hour)
	}
	_ = s.Store.SnoozeReminder(r.Context(), c.OrgID, c.UserID, r.FormValue("key"), r.FormValue("label"), until)
	http.Redirect(w, r, "/?ok=snooze", http.StatusSeeOther)
}

func (s *Server) handleReports(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	rows, err := s.Store.ListReports(r.Context(), c.OrgID, c.UserID)
	p := s.basePage(r, "Reports", "reports")
	if err != nil {
		p.Error = err.Error()
	} else {
		p.Data = rows
	}
	if r.URL.Query().Get("ok") == "1" {
		p.Flash = "Developer report submitted."
	}
	if e := r.URL.Query().Get("err"); e != "" {
		p.Error = e
	}
	s.render(w, "reports.html", p)
}

func (s *Server) handleReportCreate(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	_ = r.ParseForm()
	err := s.Store.CreateDeveloperReport(r.Context(), c.OrgID, c.UserID, store.DevReportInput{
		WhatWorked:     r.FormValue("whatWorked"),
		Blockers:       r.FormValue("blockers"),
		NeedsAttention: r.FormValue("needsAttention"),
		Implemented:    r.FormValue("implemented"),
		Pending:        r.FormValue("pending"),
		NextPlan:       r.FormValue("nextPlan"),
	})
	if err != nil {
		http.Redirect(w, r, "/reports?err="+url.QueryEscape(err.Error()), http.StatusSeeOther)
		return
	}
	http.Redirect(w, r, "/reports?ok=1", http.StatusSeeOther)
}

func (s *Server) handleSchedule(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	rows, err := s.Store.ListScheduleWeek(r.Context(), c.OrgID, c.UserID)
	p := s.basePage(r, "Schedule", "schedule")
	if err != nil {
		p.Error = err.Error()
	} else {
		p.Data = rows
	}
	if r.URL.Query().Get("ok") == "1" {
		p.Flash = "Marked complete."
	}
	s.render(w, "schedule.html", p)
}

func (s *Server) handleScheduleComplete(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	err := s.Store.CompleteScheduleItem(r.Context(), c.OrgID, c.UserID, r.PathValue("id"))
	if err != nil {
		http.Redirect(w, r, "/schedule?err=1", http.StatusSeeOther)
		return
	}
	http.Redirect(w, r, "/schedule?ok=1", http.StatusSeeOther)
}

func (s *Server) handlePerformance(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	perf, err := s.Store.Performance(r.Context(), c.OrgID, c.UserID)
	p := s.basePage(r, "Performance", "performance")
	if err != nil {
		p.Error = err.Error()
	} else {
		p.Data = perf
	}
	s.render(w, "performance.html", p)
}