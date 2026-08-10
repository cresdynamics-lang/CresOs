package web

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"html/template"
	"io/fs"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/cresdynamics-lang/CresOs/apps/sales-go/internal/auth"
	"github.com/cresdynamics-lang/CresOs/apps/sales-go/internal/config"
	"github.com/cresdynamics-lang/CresOs/apps/sales-go/internal/store"
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
		"money": func(cur string, v float64) string {
			if cur == "" {
				cur = "USD"
			}
			return fmt.Sprintf("%s %.2f", cur, v)
		},
		"compact": func(cur string, v float64) string {
			if cur == "" {
				cur = "KES"
			}
			abs := v
			if abs < 0 {
				abs = -abs
			}
			switch {
			case abs >= 1_000_000_000:
				return fmt.Sprintf("%s %.1fB", cur, v/1_000_000_000)
			case abs >= 1_000_000:
				return fmt.Sprintf("%s %.1fM", cur, v/1_000_000)
			case abs >= 1_000:
				return fmt.Sprintf("%s %.1fK", cur, v/1_000)
			default:
				return fmt.Sprintf("%s %.0f", cur, v)
			}
		},
		"date": func(t time.Time) string {
			if t.IsZero() {
				return "—"
			}
			return t.Format("2 Jan 2006")
		},
		"datep": func(t *time.Time) string {
			if t == nil {
				return "—"
			}
			return t.Format("2 Jan 2006")
		},
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
			colors := []string{"#84cc16", "#0ea5e9", "#f59e0b", "#ef4444", "#8b5cf6", "#64748b"}
			total := 0
			for _, s := range slices {
				total += s.Value
			}
			if total <= 0 {
				return template.CSS("conic-gradient(#e5e7eb 0 100%)")
			}
			var b strings.Builder
			b.WriteString("conic-gradient(")
			acc := 0
			for i, s := range slices {
				start := float64(acc) / float64(total) * 100
				acc += s.Value
				end := float64(acc) / float64(total) * 100
				col := colors[i%len(colors)]
				if i > 0 {
					b.WriteString(", ")
				}
				fmt.Fprintf(&b, "%s %.2f%% %.2f%%", col, start, end)
			}
			b.WriteString(")")
			return template.CSS(b.String())
		},
		"seq": func(n int) []int {
			if n < 0 {
				n = 0
			}
			if n > 24 {
				n = 24
			}
			out := make([]int, n)
			for i := range out {
				out[i] = i
			}
			return out
		},
		"initials": func(name string) string {
			name = strings.TrimSpace(name)
			if name == "" {
				return "?"
			}
			parts := strings.Fields(name)
			first := []rune(parts[0])
			if len(parts) == 1 {
				return strings.ToUpper(string(first[0]))
			}
			last := []rune(parts[len(parts)-1])
			return strings.ToUpper(string(first[0]) + string(last[0]))
		},
		"statusTone": func(status string) string {
			s := strings.ToLower(status)
			switch s {
			case "paid", "won", "approved", "active", "available", "qualified":
				return "ok"
			case "overdue", "cancelled", "lost", "out of stock":
				return "bad"
			case "sent", "partial", "draft", "pending_approval", "prospect":
				return "warn"
			default:
				return "neutral"
			}
		},
		"hasRole": auth.HasRole,
		"lower":   strings.ToLower,
		"titlecase": func(s string) string {
			if s == "" {
				return s
			}
			return strings.ToUpper(s[:1]) + s[1:]
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
	mux.HandleFunc("GET /sales", s.withAuth(s.handleDashboard))
	mux.HandleFunc("GET /crm", s.withAuth(s.handleCRM))
	mux.HandleFunc("GET /invoices", s.withAuth(s.handleInvoices))
	mux.HandleFunc("POST /invoices", s.withAuth(s.handleInvoiceCreate))
	mux.HandleFunc("GET /projects", s.withAuth(s.handleProjects))
	mux.HandleFunc("POST /projects", s.withAuth(s.handleProjectCreate))
	mux.HandleFunc("GET /performance", s.withAuth(s.handlePerformance))
	mux.HandleFunc("GET /community", s.withAuth(s.handleCommunity))
	mux.HandleFunc("POST /community/chat", s.withAuth(s.handleCommunityChat))
	mux.HandleFunc("GET /leads", s.withAuth(s.handleLeads))
	mux.HandleFunc("GET /deals", s.withAuth(s.handleDeals))
	mux.HandleFunc("GET /reports", s.withAuth(s.handleReports))
	mux.HandleFunc("POST /reports", s.withAuth(s.handleReportCreate))
	mux.HandleFunc("POST /reports/{id}/submit", s.withAuth(s.handleReportSubmit))
	mux.HandleFunc("GET /messages", s.withAuth(s.handleMessages))
	mux.HandleFunc("POST /messages", s.withAuth(s.handleMessageSend))
	mux.HandleFunc("GET /follow-ups", s.withAuth(s.handleFollowUps))
	mux.HandleFunc("POST /follow-ups/{id}/reach", s.withAuth(s.handleFollowUpReach))
	mux.HandleFunc("POST /follow-ups/{id}/outreach", s.withAuth(s.handleFollowUpOutreach))

	// JSON APIs (parity with Node sales workspace)
	mux.HandleFunc("GET /api/sales/dashboard", s.withAuth(s.apiDashboard))
	mux.HandleFunc("GET /api/sales/invoices", s.withAuth(s.apiInvoices))
	mux.HandleFunc("GET /api/crm/leads", s.withAuth(s.apiLeads))
	mux.HandleFunc("GET /api/crm/deals", s.withAuth(s.apiDeals))
	mux.HandleFunc("GET /api/reports", s.withAuth(s.apiReports))
	mux.HandleFunc("GET /api/sales/collection-tasks", s.withAuth(s.apiCollectionTasks))
	mux.HandleFunc("POST /api/sales/collection-tasks/{id}/reach", s.withAuth(s.apiCollectionReach))
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok","service":"cresos-sales-go"}`))
	})

	return mux
}

func (s *Server) withAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := ""
		if c, err := r.Cookie(s.Cfg.CookieName); err == nil {
			token = c.Value
		}
		if token == "" {
			h := r.Header.Get("Authorization")
			if strings.HasPrefix(h, "Bearer ") {
				token = strings.TrimPrefix(h, "Bearer ")
			}
		}
		if token == "" {
			if strings.HasPrefix(r.URL.Path, "/api/") {
				http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
				return
			}
			http.Redirect(w, r, "/login", http.StatusSeeOther)
			return
		}
		claims, err := s.Auth.ParseAndValidate(r.Context(), token)
		if err != nil {
			if strings.HasPrefix(r.URL.Path, "/api/") {
				http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
				return
			}
			http.SetCookie(w, &http.Cookie{Name: s.Cfg.CookieName, Value: "", Path: "/", MaxAge: -1})
			http.Redirect(w, r, "/login", http.StatusSeeOther)
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
	AppName    string
	Title      string
	Nav        string
	UserName   string
	UserEmail  string
	Roles      []string
	Flash      string
	Error      string
	AlertCount int
	CrmOpen    bool
	Data       any
}

func (s *Server) render(w http.ResponseWriter, name string, data pageData) {
	data.AppName = s.Cfg.AppName
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := s.Tmpl.ExecuteTemplate(w, name, data); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (s *Server) handleLoginGet(w http.ResponseWriter, r *http.Request) {
	s.render(w, "login.html", pageData{Title: "Sign in"})
}

// handleSSO accepts a Node API access token (same JWT secret + Session) and sets the sales cookie.
func (s *Server) handleSSO(w http.ResponseWriter, r *http.Request) {
	token := strings.TrimSpace(r.URL.Query().Get("token"))
	if token == "" {
		http.Redirect(w, r, "/login", http.StatusSeeOther)
		return
	}
	claims, err := s.Auth.ParseAndValidate(r.Context(), token)
	if err != nil {
		http.Redirect(w, r, "/login?err=sso", http.StatusSeeOther)
		return
	}
	if !auth.HasRole(claims.RoleKeys, "sales") &&
		!auth.HasRole(claims.RoleKeys, "admin") &&
		!auth.HasRole(claims.RoleKeys, "director_admin") &&
		!auth.HasRole(claims.RoleKeys, "finance") &&
		!auth.HasRole(claims.RoleKeys, "analyst") {
		http.Error(w, "sales workspace access required", http.StatusForbidden)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     s.Cfg.CookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   s.Cfg.SecureCookie,
		MaxAge:   3600,
	})
	next := r.URL.Query().Get("next")
	if next == "" || !strings.HasPrefix(next, "/") || strings.HasPrefix(next, "//") {
		next = "/"
	}
	http.Redirect(w, r, next, http.StatusSeeOther)
}

func (s *Server) handleLoginPost(w http.ResponseWriter, r *http.Request) {
	_ = r.ParseForm()
	email := r.FormValue("email")
	password := r.FormValue("password")
	token, user, err := s.Auth.Login(r.Context(), email, password, r.RemoteAddr, r.UserAgent())
	if err != nil {
		s.render(w, "login.html", pageData{Title: "Sign in", Error: err.Error()})
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     s.Cfg.CookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   s.Cfg.SecureCookie,
		MaxAge:   3600,
	})
	_ = user
	http.Redirect(w, r, "/", http.StatusSeeOther)
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	if c := claimsFrom(r); c != nil {
		s.Auth.RevokeSession(r.Context(), c.SessionID)
	}
	http.SetCookie(w, &http.Cookie{Name: s.Cfg.CookieName, Value: "", Path: "/", MaxAge: -1})
	http.Redirect(w, r, "/login", http.StatusSeeOther)
}

func (s *Server) basePage(r *http.Request, title, nav string) pageData {
	c := claimsFrom(r)
	name := ""
	email := ""
	roles := []string{}
	if c != nil {
		roles = c.RoleKeys
		_ = s.Auth.DB.QueryRow(r.Context(), `SELECT COALESCE(name,''), email FROM "User" WHERE id = $1`, c.UserID).Scan(&name, &email)
	}
	crmOpen := nav == "crm" || nav == "messages" || nav == "invoices" || nav == "leads" || nav == "deals" || nav == "followups"
	return pageData{
		Title:     title,
		Nav:       nav,
		UserName:  auth.DisplayName(name, email),
		UserEmail: email,
		Roles:     roles,
		CrmOpen:   crmOpen,
	}
}

func (s *Server) handleDashboard(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	d, err := s.Store.Dashboard(r.Context(), c.OrgID, c.UserID, auth.IsAdmin(c.RoleKeys))
	p := s.basePage(r, "Sales Overview", "overview")
	if err != nil {
		p.Error = err.Error()
	} else {
		p.Data = d
		p.AlertCount = d.AlertCount
	}
	s.render(w, "dashboard.html", p)
}

func (s *Server) handleCRM(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	isAdmin := auth.IsAdmin(c.RoleKeys)
	contacts, err := s.Store.ListContacts(r.Context(), c.OrgID)
	leads, _ := s.Store.ListLeads(r.Context(), c.OrgID, c.UserID, isAdmin)
	deals, _ := s.Store.ListDeals(r.Context(), c.OrgID, c.UserID, isAdmin)
	invoices, _ := s.Store.ListInvoices(r.Context(), c.OrgID, c.UserID, isAdmin, 8)
	followUps, _ := s.Store.ListCollectionTasks(r.Context(), c.OrgID, c.UserID, auth.IsLeadership(c.RoleKeys))
	if len(leads) > 8 {
		leads = leads[:8]
	}
	if len(deals) > 8 {
		deals = deals[:8]
	}
	cold := make([]store.CollectionTask, 0)
	for _, t := range followUps {
		if t.Cold {
			cold = append(cold, t)
		}
	}
	if len(cold) > 8 {
		cold = cold[:8]
	}
	p := s.basePage(r, "CRM", "crm")
	if err != nil {
		p.Error = err.Error()
	}
	p.Data = map[string]any{
		"Contacts":  contacts,
		"Leads":     leads,
		"Deals":     deals,
		"Invoices":  invoices,
		"FollowUps": cold,
	}
	s.render(w, "crm.html", p)
}

func (s *Server) handleInvoices(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	isAdmin := auth.IsAdmin(c.RoleKeys)
	rows, err := s.Store.ListInvoices(r.Context(), c.OrgID, c.UserID, isAdmin, 100)
	clients, _ := s.Store.ListClientOptions(r.Context(), c.OrgID)
	projects, _ := s.Store.ListProjectOptions(r.Context(), c.OrgID, c.UserID, isAdmin)
	p := s.basePage(r, "Invoices", "invoices")
	data := map[string]any{
		"Invoices":  rows,
		"Clients":   clients,
		"Projects":  projects,
		"FormError": r.URL.Query().Get("err"),
	}
	if err != nil {
		p.Error = err.Error()
	}
	if r.URL.Query().Get("ok") != "" {
		p.Flash = "Invoice " + r.URL.Query().Get("ok") + " created — collection follow-up assigned."
	}
	p.Data = data
	s.render(w, "invoices.html", p)
}

func (s *Server) handleInvoiceCreate(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	_ = r.ParseForm()
	qty1 := 1
	fmt.Sscanf(r.FormValue("qty1"), "%d", &qty1)
	qty2 := 1
	fmt.Sscanf(r.FormValue("qty2"), "%d", &qty2)
	in := store.InvoiceCreateInput{
		ClientID:  r.FormValue("clientId"),
		ProjectID: r.FormValue("projectId"),
		IssueDate: r.FormValue("issueDate"),
		DueDate:   r.FormValue("dueDate"),
		Currency:  r.FormValue("currency"),
		Notes:     r.FormValue("notes"),
		Lines: []store.InvoiceLineInput{
			{Description: r.FormValue("desc1"), Quantity: qty1, UnitPrice: parseFormMoney(r.FormValue("price1"))},
			{Description: r.FormValue("desc2"), Quantity: qty2, UnitPrice: parseFormMoney(r.FormValue("price2"))},
		},
	}
	_, number, err := s.Store.CreateSalesInvoice(r.Context(), c.OrgID, c.UserID, in, auth.IsAdmin(c.RoleKeys))
	if err != nil {
		http.Redirect(w, r, "/invoices?err="+url.QueryEscape(err.Error())+"#new-invoice", http.StatusSeeOther)
		return
	}
	http.Redirect(w, r, "/invoices?ok="+url.QueryEscape(number), http.StatusSeeOther)
}

func parseFormMoney(s string) float64 {
	s = strings.TrimSpace(strings.ReplaceAll(s, ",", ""))
	var v float64
	fmt.Sscanf(s, "%f", &v)
	return v
}

func (s *Server) handleProjects(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	rows, err := s.Store.ListProjectDelivery(r.Context(), c.OrgID, c.UserID, auth.IsAdmin(c.RoleKeys))
	clients, _ := s.Store.ListClientOptions(r.Context(), c.OrgID)
	p := s.basePage(r, "Projects", "projects")
	if err != nil {
		p.Error = err.Error()
	}
	if r.URL.Query().Get("ok") != "" {
		p.Flash = "Project \"" + r.URL.Query().Get("ok") + "\" created — pending director approval."
	}
	p.Data = map[string]any{
		"Projects":  rows,
		"Clients":   clients,
		"FormError": r.URL.Query().Get("err"),
	}
	s.render(w, "projects.html", p)
}

func (s *Server) handleProjectCreate(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	_ = r.ParseForm()
	in := store.ProjectCreateInput{
		Name:              r.FormValue("name"),
		Type:              r.FormValue("type"),
		ClientID:          r.FormValue("clientId"),
		ClientOrOwnerName: r.FormValue("clientOrOwnerName"),
		Phone:             r.FormValue("phone"),
		Email:             r.FormValue("email"),
		Price:             r.FormValue("price"),
		ProjectDetails:    r.FormValue("projectDetails"),
		SuccessCriteria:   r.FormValue("successCriteria"),
		StartDate:         r.FormValue("startDate"),
		EndDate:           r.FormValue("endDate"),
	}
	_, name, err := s.Store.CreateSalesProject(r.Context(), c.OrgID, c.UserID, in)
	if err != nil {
		http.Redirect(w, r, "/projects?err="+url.QueryEscape(err.Error())+"#new-project", http.StatusSeeOther)
		return
	}
	http.Redirect(w, r, "/projects?ok="+url.QueryEscape(name), http.StatusSeeOther)
}

func (s *Server) handlePerformance(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	d, err := s.Store.WorkPerformance(r.Context(), c.OrgID, c.UserID)
	p := s.basePage(r, "Performance", "performance")
	if err != nil {
		p.Error = err.Error()
	} else {
		p.Data = d
	}
	s.render(w, "performance.html", p)
}

func (s *Server) handleCommunity(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	channels, err := s.Store.ListCommunityChannels(r.Context(), c.OrgID)
	people, _ := s.Store.ListOrgPeople(r.Context(), c.OrgID, c.UserID)
	directs, _ := s.Store.ListDirectChats(r.Context(), c.OrgID, c.UserID)
	p := s.basePage(r, "Community", "community")
	if err != nil {
		p.Error = err.Error()
	}
	if r.URL.Query().Get("ok") != "" {
		p.Flash = "Chat started — your teammate was notified."
	}
	p.Data = map[string]any{
		"Channels":  channels,
		"People":    people,
		"Directs":   directs,
		"FormError": r.URL.Query().Get("err"),
	}
	s.render(w, "community.html", p)
}

func (s *Server) handleCommunityChat(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	_ = r.ParseForm()
	_, err := s.Store.StartDirectChat(r.Context(), c.OrgID, c.UserID, r.FormValue("participantId"), r.FormValue("message"))
	if err != nil {
		http.Redirect(w, r, "/community?err="+url.QueryEscape(err.Error()), http.StatusSeeOther)
		return
	}
	http.Redirect(w, r, "/community?ok=1", http.StatusSeeOther)
}

func (s *Server) handleLeads(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	rows, err := s.Store.ListLeads(r.Context(), c.OrgID, c.UserID, auth.IsAdmin(c.RoleKeys))
	p := s.basePage(r, "Leads", "leads")
	if err != nil {
		p.Error = err.Error()
	} else {
		p.Data = rows
	}
	s.render(w, "leads.html", p)
}

func (s *Server) handleDeals(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	rows, err := s.Store.ListDeals(r.Context(), c.OrgID, c.UserID, auth.IsAdmin(c.RoleKeys))
	p := s.basePage(r, "Deals", "deals")
	if err != nil {
		p.Error = err.Error()
	} else {
		p.Data = rows
	}
	s.render(w, "deals.html", p)
}

func (s *Server) handleReports(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	rows, err := s.Store.ListReports(r.Context(), c.OrgID, c.UserID, auth.IsAdmin(c.RoleKeys))
	p := s.basePage(r, "Sales reports", "reports")
	if err != nil {
		p.Error = err.Error()
	} else {
		p.Data = rows
	}
	s.render(w, "reports.html", p)
}

func (s *Server) handleReportCreate(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	_ = r.ParseForm()
	title := strings.TrimSpace(r.FormValue("title"))
	body := strings.TrimSpace(r.FormValue("body"))
	if title == "" || body == "" {
		http.Redirect(w, r, "/reports?err=missing", http.StatusSeeOther)
		return
	}
	_, err := s.Store.CreateReport(r.Context(), c.OrgID, c.UserID, title, body)
	if err != nil {
		http.Redirect(w, r, "/reports?err=create", http.StatusSeeOther)
		return
	}
	http.Redirect(w, r, "/reports", http.StatusSeeOther)
}

func (s *Server) handleReportSubmit(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	id := r.PathValue("id")
	_ = s.Store.SubmitReport(r.Context(), c.OrgID, c.UserID, id, auth.IsAdmin(c.RoleKeys))
	http.Redirect(w, r, "/reports", http.StatusSeeOther)
}

func (s *Server) handleMessages(w http.ResponseWriter, r *http.Request) {
	p := s.basePage(r, "Mails", "messages")
	p.Flash = r.URL.Query().Get("ok")
	s.render(w, "messages.html", p)
}

func (s *Server) handleMessageSend(w http.ResponseWriter, r *http.Request) {
	_ = r.ParseForm()
	to := strings.TrimSpace(r.FormValue("to"))
	subject := strings.TrimSpace(r.FormValue("subject"))
	body := strings.TrimSpace(r.FormValue("body"))
	if to == "" || subject == "" || body == "" {
		http.Redirect(w, r, "/messages?err=1", http.StatusSeeOther)
		return
	}
	// Persist as EventLog-style note for now; production email still flows via Node Resend stack.
	c := claimsFrom(r)
	_, _ = s.Auth.DB.Exec(r.Context(), `
		INSERT INTO "EventLog" (id, "orgId", "actorId", type, "entityType", "entityId", metadata, "createdAt")
		VALUES ($1, $2, $3, 'sales.mail.compose', 'mail', $4, $5::jsonb, NOW())
	`, newEventID(), c.OrgID, c.UserID, to, fmt.Sprintf(`{"subject":%q}`, subject))
	http.Redirect(w, r, "/messages?ok=queued", http.StatusSeeOther)
}

func (s *Server) handleFollowUps(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	canSeeAll := auth.IsLeadership(c.RoleKeys)
	rows, err := s.Store.ListCollectionTasks(r.Context(), c.OrgID, c.UserID, canSeeAll)
	p := s.basePage(r, "Follow-ups", "followups")
	if err != nil {
		p.Error = err.Error()
	} else {
		p.Data = rows
		open := 0
		for _, t := range rows {
			if t.Status == "open" {
				open++
			}
		}
		p.AlertCount = open
	}
	switch r.URL.Query().Get("ok") {
	case "reached":
		p.Flash = "Client reach logged — admin, finance, and director were notified."
	case "outreach":
		p.Flash = "Outreach message saved on this cold follow-up."
	}
	s.render(w, "followups.html", p)
}

func (s *Server) handleFollowUpReach(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	_ = r.ParseForm()
	id := r.PathValue("id")
	note := strings.TrimSpace(r.FormValue("clientNote"))
	err := s.Store.MarkCollectionReached(r.Context(), c.OrgID, c.UserID, id, note, auth.IsLeadership(c.RoleKeys))
	if err != nil {
		http.Redirect(w, r, "/follow-ups?err="+url.QueryEscape(err.Error()), http.StatusSeeOther)
		return
	}
	http.Redirect(w, r, "/follow-ups?ok=reached", http.StatusSeeOther)
}

func (s *Server) handleFollowUpOutreach(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	_ = r.ParseForm()
	id := r.PathValue("id")
	msg := strings.TrimSpace(r.FormValue("message"))
	err := s.Store.AddCollectionOutreach(r.Context(), c.OrgID, c.UserID, id, msg, auth.IsLeadership(c.RoleKeys))
	if err != nil {
		http.Redirect(w, r, "/follow-ups?err="+url.QueryEscape(err.Error())+"#task-"+id, http.StatusSeeOther)
		return
	}
	http.Redirect(w, r, "/follow-ups?ok=outreach#task-"+id, http.StatusSeeOther)
}

func (s *Server) apiCollectionTasks(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	rows, err := s.Store.ListCollectionTasks(r.Context(), c.OrgID, c.UserID, auth.IsLeadership(c.RoleKeys))
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{"success": true, "data": rows})
}

func (s *Server) apiCollectionReach(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	var body struct {
		ClientNote string `json:"clientNote"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	if body.ClientNote == "" {
		_ = r.ParseForm()
		body.ClientNote = r.FormValue("clientNote")
	}
	err := s.Store.MarkCollectionReached(r.Context(), c.OrgID, c.UserID, r.PathValue("id"), body.ClientNote, auth.IsLeadership(c.RoleKeys))
	if err != nil {
		writeJSON(w, 400, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{"success": true})
}

func newEventID() string {
	return fmt.Sprintf("c%x", time.Now().UnixNano())
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func (s *Server) apiDashboard(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	d, err := s.Store.Dashboard(r.Context(), c.OrgID, c.UserID, auth.IsAdmin(c.RoleKeys))
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{"success": true, "data": d})
}

func (s *Server) apiInvoices(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	rows, err := s.Store.ListInvoices(r.Context(), c.OrgID, c.UserID, auth.IsAdmin(c.RoleKeys), 100)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{"success": true, "data": map[string]any{"invoices": rows}})
}

func (s *Server) apiLeads(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	rows, err := s.Store.ListLeads(r.Context(), c.OrgID, c.UserID, auth.IsAdmin(c.RoleKeys))
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{"success": true, "data": rows})
}

func (s *Server) apiDeals(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	rows, err := s.Store.ListDeals(r.Context(), c.OrgID, c.UserID, auth.IsAdmin(c.RoleKeys))
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{"success": true, "data": rows})
}

func (s *Server) apiReports(w http.ResponseWriter, r *http.Request) {
	c := claimsFrom(r)
	rows, err := s.Store.ListReports(r.Context(), c.OrgID, c.UserID, auth.IsAdmin(c.RoleKeys))
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{"success": true, "data": rows})
}
