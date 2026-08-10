package store

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/lucsky/cuid"
)

type Store struct {
	DB *pgxpool.Pool
}

type ChartSlice struct {
	Label string
	Value int
}

type MonthPoint struct {
	Label       string
	Sales       float64
	Insight     float64
	SalesDots   int
	InsightDots int
}

type DashboardData struct {
	Stats struct {
		Total       int
		Outstanding int
		Paid        int
		Cancelled   int
		Overdue     int
	}
	KPIs struct {
		LeadsThisWeek        int
		ActiveDeals          int
		WonDeals             int
		ActiveProjects       int
		Clients              int
		DealsClosed          int
		ClientCommunications int
		ProposalsSent        int
		FollowUpsUpcoming    int
		CollectionOpen       int
	}
	Charts struct {
		Invoices []ChartSlice
		Deals    []ChartSlice
		Projects []ChartSlice
		Tasks    []ChartSlice
	}
	Alerts struct {
		OutstandingInvoices  int
		OverdueInvoices      int
		LeadsPendingApproval int
		DealsInProspect      int
		CollectionOpen       int
		ReportReminderDue    bool
	}
	Queue []QueueItem
	RecentInvoices   []InvoiceRow
	OpenCollections  []CollectionTask
	Monthly          []MonthPoint
	TotalRevenue     float64
	OutstandingAmt   float64
	Currency         string
	AlertCount       int
	ChartMaxLabel    string
}

type QueueItem struct {
	Label  string
	Value  int
	Href   string
	Tone   string
}

type InvoiceRow struct {
	ID          string
	Number      string
	Status      string
	Currency    string
	TotalAmount float64
	ClientName  string
	ProjectName string
	IssueDate   time.Time
	DueDate     *time.Time
}

type LeadRow struct {
	ID             string
	Title          string
	Status         string
	ApprovalStatus string
	Source         string
	OwnerName      string
	CreatedAt      time.Time
}

type DealRow struct {
	ID        string
	Title     string
	Stage     string
	Value     float64
	OwnerName string
	CreatedAt time.Time
}

type ContactRow struct {
	ID        string
	Name      string
	Email     string
	Phone     string
	CreatedAt time.Time
}

type ReportRow struct {
	ID           string
	Title        string
	Status       string
	ReviewStatus string
	SubmittedAt  *time.Time
	CreatedAt    time.Time
	AuthorName   string
}

type CollectionTask struct {
	ID           string
	Status       string
	Source       string
	DueAt        time.Time
	ReachedAt    *time.Time
	ClientNote   string
	InvoiceID    string
	InvoiceNo    string
	InvoiceAmt   float64
	Currency     string
	ClientName   string
	ClientPhone  string
	ClientEmail  string
	ProjectName  string
	AssigneeName string
	AssigneeID   string
	Cold         bool
	OutreachHint string
	Notes        []CollectionNote
}

type CollectionNote struct {
	ID         string
	Content    string
	AuthorName string
	CreatedAt  time.Time
}

func (s *Store) Dashboard(ctx context.Context, orgID, userID string, isAdmin bool) (*DashboardData, error) {
	d := &DashboardData{}
	invWhere := `i."orgId" = $1 AND i."deletedAt" IS NULL`
	args := []any{orgID}
	if !isAdmin {
		invWhere += ` AND EXISTS (
			SELECT 1 FROM "Project" p
			WHERE p.id = i."projectId"
			  AND (p."createdByUserId" = $2 OR p."ownerUserId" = $2)
		)`
		args = append(args, userID)
	}

	q := func(extra string) (int, error) {
		var n int
		err := s.DB.QueryRow(ctx, fmt.Sprintf(`SELECT COUNT(*) FROM "Invoice" i WHERE %s %s`, invWhere, extra), args...).Scan(&n)
		return n, err
	}

	var err error
	if d.Stats.Total, err = q(""); err != nil {
		return nil, err
	}
	if d.Stats.Outstanding, err = q(`AND i.status IN ('draft','sent','partial','overdue')`); err != nil {
		return nil, err
	}
	if d.Stats.Paid, err = q(`AND i.status = 'paid'`); err != nil {
		return nil, err
	}
	if d.Stats.Cancelled, err = q(`AND i.status = 'cancelled'`); err != nil {
		return nil, err
	}
	if d.Stats.Overdue, err = q(`AND i.status = 'overdue'`); err != nil {
		return nil, err
	}

	startOfWeek := time.Now()
	startOfWeek = time.Date(startOfWeek.Year(), startOfWeek.Month(), startOfWeek.Day()-int(startOfWeek.Weekday()), 0, 0, 0, 0, startOfWeek.Location())
	leadOwner := ""
	leadArgs := []any{orgID, startOfWeek}
	if !isAdmin {
		leadOwner = ` AND "ownerId" = $3`
		leadArgs = append(leadArgs, userID)
	}
	_ = s.DB.QueryRow(ctx, `
		SELECT COUNT(*) FROM "Lead"
		WHERE "orgId" = $1 AND "deletedAt" IS NULL AND "createdAt" >= $2`+leadOwner,
		leadArgs...).Scan(&d.KPIs.LeadsThisWeek)

	leadPendingArgs := []any{orgID}
	leadPendingOwner := ""
	if !isAdmin {
		leadPendingOwner = ` AND "ownerId" = $2`
		leadPendingArgs = append(leadPendingArgs, userID)
	}
	_ = s.DB.QueryRow(ctx, `
		SELECT COUNT(*) FROM "Lead"
		WHERE "orgId" = $1 AND "deletedAt" IS NULL AND "approvalStatus" = 'pending_approval'`+leadPendingOwner,
		leadPendingArgs...).Scan(&d.Alerts.LeadsPendingApproval)

	dealWhere := `"orgId" = $1 AND "deletedAt" IS NULL`
	dealArgs := []any{orgID}
	if !isAdmin {
		dealWhere += ` AND "ownerId" = $2`
		dealArgs = append(dealArgs, userID)
	}
	rows, err := s.DB.Query(ctx, `SELECT COALESCE(stage,'prospect') FROM "Deal" WHERE `+dealWhere, dealArgs...)
	if err != nil {
		return nil, err
	}
	dealCounts := map[string]int{}
	for rows.Next() {
		var stage string
		_ = rows.Scan(&stage)
		dealCounts[stage]++
		if stage == "won" {
			d.KPIs.WonDeals++
		} else if stage != "lost" {
			d.KPIs.ActiveDeals++
		}
		if stage == "prospect" {
			d.Alerts.DealsInProspect++
		}
	}
	rows.Close()
	for k, v := range dealCounts {
		d.Charts.Deals = append(d.Charts.Deals, ChartSlice{Label: k, Value: v})
	}

	_ = s.DB.QueryRow(ctx, `
		SELECT COUNT(*) FROM "Project"
		WHERE "orgId" = $1 AND "deletedAt" IS NULL
		  AND status IN ('active','planned')
	`, orgID).Scan(&d.KPIs.ActiveProjects)

	prows, _ := s.DB.Query(ctx, `
		SELECT COALESCE(status,'planned'), COUNT(*)
		FROM "Project" WHERE "orgId" = $1 AND "deletedAt" IS NULL
		GROUP BY 1
	`, orgID)
	if prows != nil {
		for prows.Next() {
			var label string
			var n int
			_ = prows.Scan(&label, &n)
			d.Charts.Projects = append(d.Charts.Projects, ChartSlice{Label: label, Value: n})
		}
		prows.Close()
	}

	irows, _ := s.DB.Query(ctx, fmt.Sprintf(`
		SELECT i.status, COUNT(*) FROM "Invoice" i WHERE %s GROUP BY i.status
	`, invWhere), args...)
	if irows != nil {
		for irows.Next() {
			var label string
			var n int
			_ = irows.Scan(&label, &n)
			d.Charts.Invoices = append(d.Charts.Invoices, ChartSlice{Label: label, Value: n})
		}
		irows.Close()
	}

	d.Alerts.OutstandingInvoices = d.Stats.Outstanding
	d.Alerts.OverdueInvoices = d.Stats.Overdue

	_ = s.DB.QueryRow(ctx, `SELECT COUNT(*) FROM "Client" WHERE "orgId"=$1 AND "deletedAt" IS NULL`, orgID).Scan(&d.KPIs.Clients)
	wonOwner := ""
	wonArgs := []any{orgID}
	if !isAdmin {
		wonOwner = ` AND "ownerId"=$2`
		wonArgs = append(wonArgs, userID)
	}
	_ = s.DB.QueryRow(ctx, `SELECT COUNT(*) FROM "Deal" WHERE "orgId"=$1 AND "deletedAt" IS NULL AND stage='won'`+wonOwner, wonArgs...).Scan(&d.KPIs.DealsClosed)
	d.KPIs.WonDeals = d.KPIs.DealsClosed

	// CRM writes follow_up|proposal|negotiation|close|lost; keep legacy call/meeting/… for old rows.
	commSQL := `
		SELECT COUNT(*) FROM "DealActivity" da
		JOIN "Deal" d ON d.id = da."dealId"
		WHERE da."orgId"=$1 AND d."deletedAt" IS NULL
		  AND da.type IN ('follow_up','negotiation','close','lost','call','meeting','whatsapp','email','note')`
	commArgs := []any{orgID}
	if !isAdmin {
		commSQL += ` AND d."ownerId"=$2`
		commArgs = append(commArgs, userID)
	}
	_ = s.DB.QueryRow(ctx, commSQL, commArgs...).Scan(&d.KPIs.ClientCommunications)

	propSQL := `
		SELECT COUNT(*) FROM "DealActivity" da
		JOIN "Deal" d ON d.id = da."dealId"
		WHERE da."orgId"=$1 AND da.type='proposal' AND d."deletedAt" IS NULL`
	propArgs := []any{orgID}
	if !isAdmin {
		propSQL += ` AND d."ownerId"=$2`
		propArgs = append(propArgs, userID)
	}
	_ = s.DB.QueryRow(ctx, propSQL, propArgs...).Scan(&d.KPIs.ProposalsSent)

	fuSQL := `SELECT COUNT(*) FROM "LeadFollowUp" WHERE "orgId"=$1 AND "scheduledAt" >= NOW()`
	fuArgs := []any{orgID}
	if !isAdmin {
		fuSQL += ` AND "assignedToId"=$2`
		fuArgs = append(fuArgs, userID)
	}
	_ = s.DB.QueryRow(ctx, fuSQL, fuArgs...).Scan(&d.KPIs.FollowUpsUpcoming)

	colSQL := `SELECT COUNT(*) FROM "InvoiceCollectionTask" WHERE "orgId"=$1 AND status='open'`
	colArgs := []any{orgID}
	if !isAdmin {
		colSQL += ` AND "assignedToId"=$2`
		colArgs = append(colArgs, userID)
	}
	_ = s.DB.QueryRow(ctx, colSQL, colArgs...).Scan(&d.KPIs.CollectionOpen)
	d.Alerts.CollectionOpen = d.KPIs.CollectionOpen

	d.AlertCount = d.Alerts.OverdueInvoices + d.Alerts.LeadsPendingApproval + d.Alerts.DealsInProspect + d.Alerts.CollectionOpen
	if d.AlertCount < 0 {
		d.AlertCount = 0
	}

	// Week schedule: done vs pending (aligns with Next.js tasks chart)
	var schedDone, schedPending int
	_ = s.DB.QueryRow(ctx, `
		SELECT
		  COUNT(*) FILTER (WHERE status='completed' OR "completedAt" IS NOT NULL),
		  COUNT(*) FILTER (WHERE status IN ('scheduled','missed','rescheduled') AND "completedAt" IS NULL)
		FROM "ScheduleItem"
		WHERE "orgId"=$1 AND "userId"=$2
		  AND "scheduledAt" >= date_trunc('week', NOW())
		  AND "scheduledAt" < date_trunc('week', NOW()) + INTERVAL '7 days'
	`, orgID, userID).Scan(&schedDone, &schedPending)
	d.Charts.Tasks = []ChartSlice{
		{Label: "done", Value: schedDone},
		{Label: "pending", Value: schedPending},
	}

	var lastReport *time.Time
	_ = s.DB.QueryRow(ctx, `
		SELECT MAX("submittedAt") FROM "SalesReport"
		WHERE "orgId"=$1 AND "submittedById"=$2 AND status='submitted'
	`, orgID, userID).Scan(&lastReport)
	var focusUpdated *time.Time
	_ = s.DB.QueryRow(ctx, `SELECT "currentFocusUpdatedAt" FROM "User" WHERE id=$1`, userID).Scan(&focusUpdated)
	focusFresh := focusUpdated != nil && time.Since(*focusUpdated) <= 12*time.Hour
	if !focusFresh && (lastReport == nil || time.Since(*lastReport) > 12*time.Hour) {
		d.Alerts.ReportReminderDue = true
	}

	d.Queue = []QueueItem{
		{Label: "Collection due", Value: d.KPIs.CollectionOpen, Href: "/follow-ups", Tone: "warn"},
		{Label: "Overdue invoices", Value: d.Alerts.OverdueInvoices, Href: "/invoices", Tone: "bad"},
		{Label: "Leads pending", Value: d.Alerts.LeadsPendingApproval, Href: "/leads", Tone: "warn"},
		{Label: "Week tasks open", Value: schedPending, Href: "/reports", Tone: "ok"},
		{Label: "Deals in prospect", Value: d.Alerts.DealsInProspect, Href: "/deals", Tone: "ok"},
	}
	if d.Alerts.ReportReminderDue {
		d.Queue = append([]QueueItem{{Label: "Report due", Value: 1, Href: "/reports", Tone: "bad"}}, d.Queue...)
	}

	if tasks, err := s.ListCollectionTasks(ctx, orgID, userID, isAdmin); err == nil {
		for _, t := range tasks {
			if t.Status == "open" {
				d.OpenCollections = append(d.OpenCollections, t)
				if len(d.OpenCollections) >= 5 {
					break
				}
			}
		}
	}

	_ = s.DB.QueryRow(ctx, fmt.Sprintf(`
		SELECT COALESCE(SUM(CASE WHEN i.status='paid' THEN i."totalAmount" ELSE 0 END),0)::float8,
		       COALESCE(SUM(CASE WHEN i.status IN ('draft','sent','partial','overdue') THEN i."totalAmount" ELSE 0 END),0)::float8,
		       COALESCE(MAX(i.currency),'KES')
		FROM "Invoice" i WHERE %s
	`, invWhere), args...).Scan(&d.TotalRevenue, &d.OutstandingAmt, &d.Currency)
	if d.Currency == "" {
		d.Currency = "KES"
	}

	recentSQL := fmt.Sprintf(`
		SELECT i.id, i.number, i.status, i.currency, i."totalAmount"::float8, i."issueDate", i."dueDate",
		       COALESCE(c.name, 'Unknown'), COALESCE(p.name, '')
		FROM "Invoice" i
		LEFT JOIN "Client" c ON c.id = i."clientId"
		LEFT JOIN "Project" p ON p.id = i."projectId"
		WHERE %s
		ORDER BY i."createdAt" DESC
		LIMIT 10
	`, invWhere)
	rrows, err := s.DB.Query(ctx, recentSQL, args...)
	if err != nil {
		return nil, err
	}
	defer rrows.Close()
	for rrows.Next() {
		var row InvoiceRow
		if err := rrows.Scan(&row.ID, &row.Number, &row.Status, &row.Currency, &row.TotalAmount, &row.IssueDate, &row.DueDate, &row.ClientName, &row.ProjectName); err != nil {
			return nil, err
		}
		d.RecentInvoices = append(d.RecentInvoices, row)
	}

	d.Monthly = buildMonthlySeries(ctx, s, invWhere, args)
	d.ChartMaxLabel = "100K"
	var maxV float64
	for _, m := range d.Monthly {
		if m.Sales+m.Insight > maxV {
			maxV = m.Sales + m.Insight
		}
	}
	if maxV <= 0 {
		maxV = 1
	}
	d.ChartMaxLabel = compactMoney(maxV)
	const maxDots = 14
	for i := range d.Monthly {
		d.Monthly[i].SalesDots = scaleDots(d.Monthly[i].Sales, maxV, maxDots)
		d.Monthly[i].InsightDots = scaleDots(d.Monthly[i].Insight, maxV, maxDots)
		if d.Monthly[i].SalesDots == 0 && d.Monthly[i].Sales > 0 {
			d.Monthly[i].SalesDots = 1
		}
		if d.Monthly[i].InsightDots == 0 && d.Monthly[i].Insight > 0 {
			d.Monthly[i].InsightDots = 1
		}
	}
	return d, nil
}

func scaleDots(v, max float64, maxDots int) int {
	if max <= 0 || v <= 0 {
		return 0
	}
	n := int((v/max)*float64(maxDots) + 0.5)
	if n > maxDots {
		n = maxDots
	}
	return n
}

func compactMoney(v float64) string {
	abs := v
	if abs < 0 {
		abs = -abs
	}
	switch {
	case abs >= 1_000_000_000:
		return fmt.Sprintf("%.1fB", v/1_000_000_000)
	case abs >= 1_000_000:
		return fmt.Sprintf("%.1fM", v/1_000_000)
	case abs >= 1_000:
		return fmt.Sprintf("%.0fK", v/1_000)
	default:
		return fmt.Sprintf("%.0f", v)
	}
}

func buildMonthlySeries(ctx context.Context, s *Store, invWhere string, args []any) []MonthPoint {
	now := time.Now()
	start := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()).AddDate(0, -7, 0)
	type agg struct{ sales, insight float64 }
	byMonth := map[string]agg{}

	qArgs := append([]any{}, args...)
	qArgs = append(qArgs, start)
	monthArg := len(qArgs)
	rows, err := s.DB.Query(ctx, fmt.Sprintf(`
		SELECT to_char(date_trunc('month', i."issueDate"), 'YYYY-MM'),
		       COALESCE(SUM(i."totalAmount"),0)::float8,
		       COUNT(*)::float8 * 400
		FROM "Invoice" i
		WHERE %s AND i."issueDate" >= $%d
		GROUP BY 1
		ORDER BY 1
	`, invWhere, monthArg), qArgs...)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var key string
			var sales, insight float64
			if rows.Scan(&key, &sales, &insight) == nil {
				byMonth[key] = agg{sales: sales, insight: insight}
			}
		}
	}

	out := make([]MonthPoint, 0, 8)
	for i := 0; i < 8; i++ {
		m := start.AddDate(0, i, 0)
		key := m.Format("2006-01")
		a := byMonth[key]
		out = append(out, MonthPoint{
			Label:   m.Format("Jan"),
			Sales:   a.sales,
			Insight: a.insight,
		})
	}
	return out
}

func (s *Store) ListInvoices(ctx context.Context, orgID, userID string, isAdmin bool, limit int) ([]InvoiceRow, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	invWhere := `i."orgId" = $1 AND i."deletedAt" IS NULL`
	args := []any{orgID}
	argN := 2
	if !isAdmin {
		invWhere += fmt.Sprintf(` AND EXISTS (
			SELECT 1 FROM "Project" p
			WHERE p.id = i."projectId" AND (p."createdByUserId" = $%d OR p."ownerUserId" = $%d)
		)`, argN, argN)
		args = append(args, userID)
		argN++
	}
	args = append(args, limit)
	rows, err := s.DB.Query(ctx, fmt.Sprintf(`
		SELECT i.id, i.number, i.status, i.currency, i."totalAmount"::float8, i."issueDate", i."dueDate",
		       COALESCE(c.name,'Unknown'), COALESCE(p.name,'')
		FROM "Invoice" i
		LEFT JOIN "Client" c ON c.id = i."clientId"
		LEFT JOIN "Project" p ON p.id = i."projectId"
		WHERE %s
		ORDER BY i."createdAt" DESC
		LIMIT $%d
	`, invWhere, argN), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []InvoiceRow
	for rows.Next() {
		var row InvoiceRow
		if err := rows.Scan(&row.ID, &row.Number, &row.Status, &row.Currency, &row.TotalAmount, &row.IssueDate, &row.DueDate, &row.ClientName, &row.ProjectName); err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

func (s *Store) ListLeads(ctx context.Context, orgID, userID string, isAdmin bool) ([]LeadRow, error) {
	where := `l."orgId" = $1 AND l."deletedAt" IS NULL`
	args := []any{orgID}
	if !isAdmin {
		where += ` AND l."ownerId" = $2`
		args = append(args, userID)
	}
	rows, err := s.DB.Query(ctx, `
		SELECT l.id, l.title, l.status, l."approvalStatus", COALESCE(l.source,''),
		       COALESCE(u.name, u.email, ''), l."createdAt"
		FROM "Lead" l
		LEFT JOIN "User" u ON u.id = l."ownerId"
		WHERE `+where+`
		ORDER BY l."createdAt" DESC
		LIMIT 100
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []LeadRow
	for rows.Next() {
		var r LeadRow
		if err := rows.Scan(&r.ID, &r.Title, &r.Status, &r.ApprovalStatus, &r.Source, &r.OwnerName, &r.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *Store) ListDeals(ctx context.Context, orgID, userID string, isAdmin bool) ([]DealRow, error) {
	where := `d."orgId" = $1 AND d."deletedAt" IS NULL`
	args := []any{orgID}
	if !isAdmin {
		where += ` AND d."ownerId" = $2`
		args = append(args, userID)
	}
	rows, err := s.DB.Query(ctx, `
		SELECT d.id, d.title, d.stage, COALESCE(d.value,0)::float8,
		       COALESCE(u.name, u.email, ''), d."createdAt"
		FROM "Deal" d
		LEFT JOIN "User" u ON u.id = d."ownerId"
		WHERE `+where+`
		ORDER BY d."createdAt" DESC
		LIMIT 100
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []DealRow
	for rows.Next() {
		var r DealRow
		if err := rows.Scan(&r.ID, &r.Title, &r.Stage, &r.Value, &r.OwnerName, &r.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *Store) ListContacts(ctx context.Context, orgID string) ([]ContactRow, error) {
	rows, err := s.DB.Query(ctx, `
		SELECT id, COALESCE(name,''), COALESCE(email,''), COALESCE(phone,''), "createdAt"
		FROM "CrmContact"
		WHERE "orgId" = $1 AND "deletedAt" IS NULL
		ORDER BY "createdAt" DESC
		LIMIT 100
	`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []ContactRow
	for rows.Next() {
		var r ContactRow
		if err := rows.Scan(&r.ID, &r.Name, &r.Email, &r.Phone, &r.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *Store) ListReports(ctx context.Context, orgID, userID string, isAdmin bool) ([]ReportRow, error) {
	where := `r."orgId" = $1`
	args := []any{orgID}
	if !isAdmin {
		where += ` AND r."submittedById" = $2`
		args = append(args, userID)
	}
	rows, err := s.DB.Query(ctx, `
		SELECT r.id, r.title, r.status, r."reviewStatus", r."submittedAt", r."createdAt",
		       COALESCE(u.name, u.email, '')
		FROM "SalesReport" r
		JOIN "User" u ON u.id = r."submittedById"
		WHERE `+where+`
		ORDER BY r."createdAt" DESC
		LIMIT 100
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []ReportRow
	for rows.Next() {
		var r ReportRow
		if err := rows.Scan(&r.ID, &r.Title, &r.Status, &r.ReviewStatus, &r.SubmittedAt, &r.CreatedAt, &r.AuthorName); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *Store) CreateReport(ctx context.Context, orgID, userID, title, body string) (string, error) {
	id := newID()
	_, err := s.DB.Exec(ctx, `
		INSERT INTO "SalesReport" (id, "orgId", "submittedById", title, body, status, "reviewStatus", "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, $5, 'draft', 'pending', NOW(), NOW())
	`, id, orgID, userID, title, body)
	return id, err
}

func (s *Store) SubmitReport(ctx context.Context, orgID, userID, id string, isAdmin bool) error {
	q := `UPDATE "SalesReport" SET status = 'submitted', "submittedAt" = NOW(), "updatedAt" = NOW()
		WHERE id = $1 AND "orgId" = $2`
	args := []any{id, orgID}
	if !isAdmin {
		q += ` AND "submittedById" = $3`
		args = append(args, userID)
	}
	ct, err := s.DB.Exec(ctx, q, args...)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("report not found")
	}
	return nil
}

func (s *Store) ListCollectionTasks(ctx context.Context, orgID, userID string, canSeeAll bool) ([]CollectionTask, error) {
	where := `t."orgId" = $1`
	args := []any{orgID}
	if !canSeeAll {
		where += ` AND t."assignedToId" = $2`
		args = append(args, userID)
	}
	rows, err := s.DB.Query(ctx, `
		SELECT t.id, t.status, t.source, t."dueAt", t."reachedAt", COALESCE(t."clientNote",''),
		       i.id, i.number, i."totalAmount"::float8, i.currency,
		       COALESCE(c.name,'Unknown'), COALESCE(c.phone,''), COALESCE(c.email,''),
		       COALESCE(p.name,''),
		       COALESCE(u.name, u.email, ''), t."assignedToId"
		FROM "InvoiceCollectionTask" t
		JOIN "Invoice" i ON i.id = t."invoiceId"
		JOIN "Client" c ON c.id = i."clientId"
		LEFT JOIN "Project" p ON p.id = i."projectId"
		JOIN "User" u ON u.id = t."assignedToId"
		WHERE `+where+`
		ORDER BY CASE t.status WHEN 'open' THEN 0 WHEN 'reached' THEN 1 ELSE 2 END, t."dueAt" ASC
		LIMIT 100
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []CollectionTask
	for rows.Next() {
		var t CollectionTask
		if err := rows.Scan(
			&t.ID, &t.Status, &t.Source, &t.DueAt, &t.ReachedAt, &t.ClientNote,
			&t.InvoiceID, &t.InvoiceNo, &t.InvoiceAmt, &t.Currency,
			&t.ClientName, &t.ClientPhone, &t.ClientEmail,
			&t.ProjectName, &t.AssigneeName, &t.AssigneeID,
		); err != nil {
			return nil, err
		}
		t.Cold = t.Status == "open"
		t.OutreachHint = fmt.Sprintf(
			"Hi %s — following up on invoice %s (%s %.2f), due %s. Please confirm payment status or a date we can expect settlement. Thanks, %s.",
			t.ClientName, t.InvoiceNo, t.Currency, t.InvoiceAmt, t.DueAt.Format("2 Jan 2006"), t.AssigneeName,
		)
		nrows, nerr := s.DB.Query(ctx, `
			SELECT n.id, n.content, COALESCE(u.name, u.email, ''), n."createdAt"
			FROM "InvoiceCollectionNote" n
			JOIN "User" u ON u.id = n."authorId"
			WHERE n."taskId"=$1
			ORDER BY n."createdAt" ASC
			LIMIT 50
		`, t.ID)
		if nerr == nil {
			for nrows.Next() {
				var note CollectionNote
				if nrows.Scan(&note.ID, &note.Content, &note.AuthorName, &note.CreatedAt) == nil {
					t.Notes = append(t.Notes, note)
				}
			}
			nrows.Close()
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (s *Store) AddCollectionOutreach(ctx context.Context, orgID, userID, taskID, content string, canSeeAll bool) error {
	content = strings.TrimSpace(content)
	if content == "" {
		return fmt.Errorf("outreach message is required")
	}
	where := `t.id=$1 AND t."orgId"=$2`
	args := []any{taskID, orgID}
	if !canSeeAll {
		where += ` AND t."assignedToId"=$3`
		args = append(args, userID)
	}
	var invoiceNo, assigneeName string
	err := s.DB.QueryRow(ctx, `
		SELECT i.number, COALESCE(u.name, u.email, '')
		FROM "InvoiceCollectionTask" t
		JOIN "Invoice" i ON i.id=t."invoiceId"
		JOIN "User" u ON u.id=t."assignedToId"
		WHERE `+where+`
	`, args...).Scan(&invoiceNo, &assigneeName)
	if err != nil {
		return fmt.Errorf("follow-up not found")
	}
	_, err = s.DB.Exec(ctx, `
		INSERT INTO "InvoiceCollectionNote" (id, "orgId", "taskId", "authorId", content, "createdAt")
		VALUES ($1,$2,$3,$4,$5,NOW())
	`, newID(), orgID, taskID, userID, content)
	if err != nil {
		return err
	}
	_, _ = s.DB.Exec(ctx, `
		UPDATE "InvoiceCollectionTask" SET "clientNote"=$1, "updatedAt"=NOW() WHERE id=$2 AND "orgId"=$3
	`, content, taskID, orgID)
	_, _ = s.DB.Exec(ctx, `
		INSERT INTO "EventLog" (id, "orgId", "actorId", type, "entityType", "entityId", metadata, "createdAt")
		VALUES ($1,$2,$3,'invoice.collection.outreach','invoice_collection_task',$4,
		        jsonb_build_object('invoiceNumber',$5::text,'salesName',$6::text,'content',$7::text), NOW())
	`, newID(), orgID, userID, taskID, invoiceNo, assigneeName, content)
	return nil
}

func (s *Store) MarkCollectionReached(ctx context.Context, orgID, userID, taskID, note string, canSeeAll bool) error {
	note = strings.TrimSpace(note)
	if note == "" {
		return fmt.Errorf("client note is required")
	}
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	where := `t.id=$1 AND t."orgId"=$2`
	args := []any{taskID, orgID}
	if !canSeeAll {
		where += ` AND t."assignedToId"=$3`
		args = append(args, userID)
	}
	var invoiceID, assigneeID, invoiceNo, assigneeName string
	err = tx.QueryRow(ctx, `
		SELECT t."invoiceId", t."assignedToId", i.number, COALESCE(u.name, u.email, '')
		FROM "InvoiceCollectionTask" t
		JOIN "Invoice" i ON i.id = t."invoiceId"
		JOIN "User" u ON u.id = t."assignedToId"
		WHERE `+where+`
	`, args...).Scan(&invoiceID, &assigneeID, &invoiceNo, &assigneeName)
	if err != nil {
		return fmt.Errorf("collection task not found")
	}

	ct, err := tx.Exec(ctx, `
		UPDATE "InvoiceCollectionTask"
		SET status='reached', "reachedAt"=NOW(), "clientNote"=$1, "updatedAt"=NOW()
		WHERE id=$2 AND "orgId"=$3
	`, note, taskID, orgID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("collection task not found")
	}
	noteID := newID()
	_, err = tx.Exec(ctx, `
		INSERT INTO "InvoiceCollectionNote" (id, "orgId", "taskId", "authorId", content, "createdAt")
		VALUES ($1,$2,$3,$4,$5,NOW())
	`, noteID, orgID, taskID, userID, note)
	if err != nil {
		return err
	}
	eventID := newID()
	_, err = tx.Exec(ctx, `
		INSERT INTO "EventLog" (id, "orgId", "actorId", type, "entityType", "entityId", metadata, "createdAt")
		VALUES ($1,$2,$3,'invoice.collection.reached','invoice',$4,
		        jsonb_build_object('taskId',$5::text,'invoiceNumber',$6::text,'salesUserId',$7::text,'salesName',$8::text,'clientNote',$9::text),
		        NOW())
	`, eventID, orgID, userID, invoiceID, taskID, invoiceNo, assigneeID, assigneeName, note)
	if err != nil {
		return err
	}

	// Notify admin / finance / director
	nRows, err := tx.Query(ctx, `
		SELECT DISTINCT u.id FROM "User" u
		JOIN "UserRole" ur ON ur."userId"=u.id
		JOIN "Role" r ON r.id=ur."roleId"
		WHERE r."orgId"=$1 AND r.key IN ('admin','finance','director_admin')
		  AND u."deletedAt" IS NULL
	`, orgID)
	if err == nil {
		defer nRows.Close()
		for nRows.Next() {
			var to string
			if nRows.Scan(&to) != nil {
				continue
			}
			nid := newID()
			_, _ = tx.Exec(ctx, `
				INSERT INTO "Notification" (id, "orgId", channel, "to", subject, body, status, type, tier, "createdAt")
				VALUES ($1,$2,'in_app',$3,$4,$5,'sent','invoice.collection.reached','financial',NOW())
			`, nid, orgID, to,
				fmt.Sprintf("Client reached · %s", invoiceNo),
				fmt.Sprintf("%s reached the client about invoice %s: %s", assigneeName, invoiceNo, note))
		}
	}
	return tx.Commit(ctx)
}

func (s *Store) EscalateInvoiceCollection(ctx context.Context, orgID, invoiceID, escalatedByID, source string) error {
	var issueDate time.Time
	var dueDate *time.Time
	var projectID *string
	var number, currency string
	var amount float64
	var clientName string
	err := s.DB.QueryRow(ctx, `
		SELECT i."issueDate", i."dueDate", i."projectId", i.number, i.currency, i."totalAmount"::float8, COALESCE(c.name,'client')
		FROM "Invoice" i
		JOIN "Client" c ON c.id=i."clientId"
		WHERE i.id=$1 AND i."orgId"=$2 AND i."deletedAt" IS NULL
	`, invoiceID, orgID).Scan(&issueDate, &dueDate, &projectID, &number, &currency, &amount, &clientName)
	if err != nil {
		return fmt.Errorf("invoice not found")
	}
	dueAt := issueDate.AddDate(0, 0, 14)
	if dueDate != nil {
		dueAt = *dueDate
	}

	assignees := []string{}
	if projectID != nil && *projectID != "" {
		var owner, creator *string
		_ = s.DB.QueryRow(ctx, `
			SELECT p."ownerUserId", p."createdByUserId" FROM "Project" p WHERE p.id=$1 AND p."orgId"=$2
		`, *projectID, orgID).Scan(&owner, &creator)
		for _, uid := range []*string{owner, creator} {
			if uid == nil || *uid == "" {
				continue
			}
			var ok int
			_ = s.DB.QueryRow(ctx, `
				SELECT 1 FROM "UserRole" ur JOIN "Role" r ON r.id=ur."roleId"
				WHERE ur."userId"=$1 AND r."orgId"=$2 AND r.key='sales' LIMIT 1
			`, *uid, orgID).Scan(&ok)
			if ok == 1 {
				assignees = append(assignees, *uid)
			}
		}
	}
	if len(assignees) == 0 {
		rows, err := s.DB.Query(ctx, `
			SELECT u.id FROM "User" u
			JOIN "UserRole" ur ON ur."userId"=u.id
			JOIN "Role" r ON r.id=ur."roleId"
			WHERE r."orgId"=$1 AND r.key='sales' AND u."deletedAt" IS NULL AND u.status='active'
		`, orgID)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var id string
				if rows.Scan(&id) == nil {
					assignees = append(assignees, id)
				}
			}
		}
	}
	if len(assignees) == 0 {
		return fmt.Errorf("no sales assignees")
	}

	for _, assignedTo := range assignees {
		id := newID()
		_, err := s.DB.Exec(ctx, `
			INSERT INTO "InvoiceCollectionTask"
				(id, "orgId", "invoiceId", "assignedToId", "escalatedById", status, "dueAt", source, "createdAt", "updatedAt")
			VALUES ($1,$2,$3,$4,$5,'open',$6,$7,NOW(),NOW())
			ON CONFLICT ("invoiceId", "assignedToId") DO UPDATE
			SET "dueAt"=EXCLUDED."dueAt", source=EXCLUDED.source, "escalatedById"=EXCLUDED."escalatedById",
			    status=CASE WHEN "InvoiceCollectionTask".status='closed' THEN 'open' ELSE "InvoiceCollectionTask".status END,
			    "updatedAt"=NOW()
		`, id, orgID, invoiceID, assignedTo, nullStr(escalatedByID), dueAt, source)
		if err != nil {
			return err
		}
		nid := newID()
		_, _ = s.DB.Exec(ctx, `
			INSERT INTO "Notification" (id, "orgId", channel, "to", subject, body, status, type, tier, "createdAt")
			VALUES ($1,$2,'in_app',$3,$4,$5,'sent','invoice.collection.escalated','financial',NOW())
		`, nid, orgID, assignedTo,
			fmt.Sprintf("Invoice due · %s", number),
			fmt.Sprintf("Finance escalated invoice %s (%s, %s %.2f). Reach the client before %s and log the outcome.",
				number, clientName, currency, amount, dueAt.Format("2006-01-02")))
	}
	eid := newID()
	_, _ = s.DB.Exec(ctx, `
		INSERT INTO "EventLog" (id, "orgId", "actorId", type, "entityType", "entityId", metadata, "createdAt")
		VALUES ($1,$2,$3,'invoice.collection.escalated','invoice',$4,
		        jsonb_build_object('number',$5::text,'source',$6::text), NOW())
	`, eid, orgID, nullStr(escalatedByID), invoiceID, number, source)
	return nil
}

func nullStr(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func newID() string {
	return cuid.New()
}
