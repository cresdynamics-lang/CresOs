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

type KPI struct {
	Label      string
	Value      string
	Sub        string
	Tone       string // up | down | flat
	Icon       string // revenue | projects | time | resources
	TrendLabel string
}

type ProjectSummary struct {
	ID           string
	Name         string
	ManagerName  string
	DueDate      *time.Time
	Status       string
	StatusLabel  string
	Progress     int
	TaskCount    int
	DoneTasks    int
	OverdueTasks int
}

type TodayTask struct {
	ID          string
	Title       string
	ProjectName string
	Status      string
	StatusLabel string
	Priority    string
	DueDate     *time.Time
	Done        bool
	Important   bool
}

type WorkloadBar struct {
	Name   string
	Count  int
	Accent string // orange | dark | blue
}

type ProgressBreakdown struct {
	Percent   int
	Total     int
	Completed int
	Delayed   int
	Ongoing   int
}

type ReportRow struct {
	ID         string
	Title      string
	Status     string
	ReportDate time.Time
	CreatedAt  time.Time
}

type PerformanceSnapshot struct {
	ReportStreakDays int
	TasksDone30d     int
	TasksOpen        int
	AvgProgress      int
	HoursLogged30d   float64
	HoursEstimated   float64
	BlockedTasks     int
	OverdueTasks     int
	ActiveProjects   int
}

type DashboardData struct {
	KPIs       []KPI
	Projects   []ProjectSummary
	TodayTasks []TodayTask
	Workload   []WorkloadBar
	Progress   ProgressBreakdown
	Perf       PerformanceSnapshot
	Alerts     []string
	Charts     struct {
		TaskMix      []ChartSlice
		ScheduleWeek []ChartSlice
		Projects     []ChartSlice
	}
	Queue []QueueItem
}

type ChartSlice struct {
	Label string
	Value int
}

type QueueItem struct {
	Label string
	Value int
	Href  string
	Tone  string
}

func (s *Store) UserProfile(ctx context.Context, userID string) (name, email, title string, err error) {
	err = s.DB.QueryRow(ctx, `
		SELECT COALESCE(name,''), email, COALESCE(NULLIF("jobTitle",''), 'Developer')
		FROM "User" WHERE id=$1
	`, userID).Scan(&name, &email, &title)
	return
}

func (s *Store) Dashboard(ctx context.Context, orgID, userID string) (*DashboardData, error) {
	d := &DashboardData{}
	perf, err := s.Performance(ctx, orgID, userID)
	if err != nil {
		return nil, err
	}
	d.Perf = *perf

	projects, err := s.ListProjectSummaries(ctx, orgID, userID, 8)
	if err != nil {
		return nil, err
	}
	d.Projects = projects

	tasks, err := s.ListDeveloperTasks(ctx, orgID, userID, 12)
	if err != nil {
		return nil, err
	}
	d.TodayTasks = tasks

	workload, err := s.TeamWorkload(ctx, orgID, userID)
	if err != nil {
		return nil, err
	}
	d.Workload = workload

	var total, completed, delayed, ongoing int
	for _, p := range projects {
		total++
		switch strings.ToLower(p.Status) {
		case "completed", "done", "closed":
			completed++
		case "at_risk", "blocked", "delayed":
			delayed++
		default:
			if p.OverdueTasks > 0 {
				delayed++
			} else {
				ongoing++
			}
		}
	}
	pct := 0
	if total > 0 {
		pct = int(float64(completed) / float64(total) * 100)
	}
	if total > 0 && completed == 0 && ongoing > 0 {
		// Weighted by average delivery on assigned work
		pct = perf.AvgProgress
	}
	d.Progress = ProgressBreakdown{
		Percent: pct, Total: total, Completed: completed, Delayed: delayed, Ongoing: ongoing,
	}

	hoursLabel := fmt.Sprintf("%.0f / %.0f Hrs", perf.HoursLogged30d, maxF(perf.HoursEstimated, perf.HoursLogged30d+40))
	if perf.HoursEstimated <= 0 {
		hoursLabel = fmt.Sprintf("%.0f Hrs", perf.HoursLogged30d)
	}
	capacity := perf.TasksDone30d + perf.TasksOpen
	capLabel := fmt.Sprintf("%d / %d", perf.TasksDone30d, maxI(capacity, 1))

	d.KPIs = []KPI{
		{
			Label: "Delivery score", Icon: "revenue", Tone: trendTone(perf.AvgProgress, 60),
			Value: fmt.Sprintf("%d%%", perf.AvgProgress),
			Sub:   fmt.Sprintf("%d assigned projects", perf.ActiveProjects),
			TrendLabel: fmt.Sprintf("%d-day report streak", perf.ReportStreakDays),
		},
		{
			Label: "Projects", Icon: "projects", Tone: "flat",
			Value: fmt.Sprintf("%d", len(projects)),
			Sub:   "Assigned by sales / director",
			TrendLabel: "Your assignments only",
		},
		{
			Label: "Time logged", Icon: "time", Tone: trendTone(int(perf.HoursLogged30d), 20),
			Value: hoursLabel,
			Sub:   "Last 30 days (your task actuals)",
			TrendLabel: "Against estimates",
		},
		{
			Label: "Task capacity", Icon: "resources", Tone: trendTone(perf.TasksDone30d, 5),
			Value: capLabel,
			Sub:   fmt.Sprintf("%d overdue · %d blocked", perf.OverdueTasks, perf.BlockedTasks),
			TrendLabel: "Done / open (assigned to you)",
		},
	}

	if perf.OverdueTasks > 0 {
		d.Alerts = append(d.Alerts, fmt.Sprintf("%d overdue task(s) need attention", perf.OverdueTasks))
	}
	if perf.BlockedTasks > 0 {
		d.Alerts = append(d.Alerts, fmt.Sprintf("%d blocked — escalate or unblock with PM", perf.BlockedTasks))
	}
	updatedToday, _ := s.hasTaskUpdateToday(ctx, orgID, userID)
	if !updatedToday && perf.TasksOpen > 0 {
		d.Alerts = append(d.Alerts, "Update your assigned tasks today so PM and director see progress")
	}
	if perf.ReportStreakDays == 0 {
		d.Alerts = append(d.Alerts, "Submit today's developer report for leadership visibility")
	}

	d.Charts.TaskMix = []ChartSlice{
		{Label: "done", Value: perf.TasksDone30d},
		{Label: "open", Value: perf.TasksOpen},
		{Label: "overdue", Value: perf.OverdueTasks},
		{Label: "blocked", Value: perf.BlockedTasks},
	}
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
	d.Charts.ScheduleWeek = []ChartSlice{
		{Label: "done", Value: schedDone},
		{Label: "pending", Value: schedPending},
	}
	for _, p := range projects {
		d.Charts.Projects = append(d.Charts.Projects, ChartSlice{Label: p.Name, Value: p.Progress})
	}
	d.Queue = []QueueItem{
		{Label: "Open tasks", Value: perf.TasksOpen, Href: "/tasks", Tone: "warn"},
		{Label: "Overdue", Value: perf.OverdueTasks, Href: "/tasks", Tone: "bad"},
		{Label: "Blocked", Value: perf.BlockedTasks, Href: "/tasks", Tone: "bad"},
		{Label: "Assigned projects", Value: len(projects), Href: "/projects", Tone: "ok"},
		{Label: "Reports", Value: perf.ReportStreakDays, Href: "/reports", Tone: "ok"},
	}
	return d, nil
}

func (s *Store) hasTaskUpdateToday(ctx context.Context, orgID, userID string) (bool, error) {
	var n int
	err := s.DB.QueryRow(ctx, `
		SELECT COUNT(*) FROM "Task"
		WHERE "orgId"=$1 AND "assigneeId"=$2 AND "deletedAt" IS NULL
		  AND "updatedAt"::date = CURRENT_DATE
	`, orgID, userID).Scan(&n)
	return n > 0, err
}

func (s *Store) Performance(ctx context.Context, orgID, userID string) (*PerformanceSnapshot, error) {
	p := &PerformanceSnapshot{}
	err := s.DB.QueryRow(ctx, `
		SELECT
		  COUNT(*) FILTER (WHERE t.status='done' AND t."updatedAt" >= NOW() - INTERVAL '30 days'),
		  COUNT(*) FILTER (WHERE t.status IN ('todo','not_started','in_progress','waiting_response','blocked')),
		  COUNT(*) FILTER (WHERE t.status='blocked'),
		  COUNT(*) FILTER (WHERE t."dueDate" < NOW() AND t.status NOT IN ('done','cancelled')),
		  COALESCE(SUM(t."actualHours") FILTER (WHERE t."updatedAt" >= NOW() - INTERVAL '30 days'),0)::float8,
		  COALESCE(SUM(t."estimatedHours") FILTER (WHERE t.status NOT IN ('done','cancelled')),0)::float8
		FROM "Task" t
		WHERE t."orgId"=$1 AND t."deletedAt" IS NULL AND t."assigneeId"=$2
	`, orgID, userID).Scan(
		&p.TasksDone30d, &p.TasksOpen, &p.BlockedTasks, &p.OverdueTasks, &p.HoursLogged30d, &p.HoursEstimated,
	)
	if err != nil {
		return nil, err
	}

	_ = s.DB.QueryRow(ctx, `
		SELECT COUNT(*), COALESCE(AVG(
		  CASE WHEN task_tot.n=0 THEN 0 ELSE (task_done.n::float8 / task_tot.n) * 100 END
		),0)::int
		FROM "Project" p
		LEFT JOIN LATERAL (
		  SELECT COUNT(*) n FROM "Task" t
		  WHERE t."projectId"=p.id AND t."deletedAt" IS NULL AND t."assigneeId"=$2
		) task_tot ON true
		LEFT JOIN LATERAL (
		  SELECT COUNT(*) n FROM "Task" t
		  WHERE t."projectId"=p.id AND t."deletedAt" IS NULL AND t."assigneeId"=$2 AND t.status='done'
		) task_done ON true
		WHERE `+assignedProjectWhere+`
		  AND lower(p.status) NOT IN ('completed','done','closed','cancelled')
	`, orgID, userID).Scan(&p.ActiveProjects, &p.AvgProgress)

	p.ReportStreakDays = s.reportStreak(ctx, orgID, userID)
	return p, nil
}

func (s *Store) reportStreak(ctx context.Context, orgID, userID string) int {
	rows, err := s.DB.Query(ctx, `
		SELECT DISTINCT date_trunc('day', "reportDate")::date AS d
		FROM "DeveloperReport"
		WHERE "orgId"=$1 AND "submittedById"=$2
		ORDER BY d DESC
		LIMIT 60
	`, orgID, userID)
	if err != nil {
		return 0
	}
	defer rows.Close()
	var days []time.Time
	for rows.Next() {
		var d time.Time
		if rows.Scan(&d) == nil {
			days = append(days, d)
		}
	}
	if len(days) == 0 {
		return 0
	}
	today := time.Now().Truncate(24 * time.Hour)
	start := days[0].Truncate(24 * time.Hour)
	if start.Before(today.Add(-24 * time.Hour)) {
		return 0
	}
	streak := 1
	expect := start.Add(-24 * time.Hour)
	for i := 1; i < len(days); i++ {
		d := days[i].Truncate(24 * time.Hour)
		if d.Equal(expect) {
			streak++
			expect = expect.Add(-24 * time.Hour)
			continue
		}
		break
	}
	return streak
}

// Matches Next.js developer project list: primary assignee or pending/accepted assignment.
const assignedProjectWhere = `
		p."orgId"=$1 AND p."deletedAt" IS NULL AND (
		  p."assignedDeveloperId" = $2
		  OR EXISTS (
		    SELECT 1 FROM "ProjectDeveloperAssignment" a
		    WHERE a."projectId"=p.id AND a."userId"=$2 AND a.status IN ('pending','accepted')
		  )
		)`

func (s *Store) ListProjectSummaries(ctx context.Context, orgID, userID string, limit int) ([]ProjectSummary, error) {
	if limit <= 0 {
		limit = 20
	}
	q := `
		SELECT p.id, p.name,
		       COALESCE(pm.name, pm.email, owner.name, owner.email, 'Unassigned'),
		       p."endDate", p.status,
		       COALESCE(tot.n,0), COALESCE(done.n,0), COALESCE(od.n,0)
		FROM "Project" p
		LEFT JOIN "User" owner ON owner.id = p."ownerUserId"
		LEFT JOIN "User" pm ON pm.id = p."projectManagerUserId"
		LEFT JOIN LATERAL (
		  SELECT COUNT(*) n FROM "Task" t
		  WHERE t."projectId"=p.id AND t."deletedAt" IS NULL AND t."assigneeId"=$2
		) tot ON true
		LEFT JOIN LATERAL (
		  SELECT COUNT(*) n FROM "Task" t
		  WHERE t."projectId"=p.id AND t."deletedAt" IS NULL AND t."assigneeId"=$2 AND t.status='done'
		) done ON true
		LEFT JOIN LATERAL (
		  SELECT COUNT(*) n FROM "Task" t
		  WHERE t."projectId"=p.id AND t."deletedAt" IS NULL AND t."assigneeId"=$2
		    AND t."dueDate" < NOW() AND t.status NOT IN ('done','cancelled')
		) od ON true
		WHERE ` + assignedProjectWhere + `
		ORDER BY p."updatedAt" DESC
		LIMIT $3
	`
	rows, err := s.DB.Query(ctx, q, orgID, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []ProjectSummary
	for rows.Next() {
		var r ProjectSummary
		if err := rows.Scan(&r.ID, &r.Name, &r.ManagerName, &r.DueDate, &r.Status, &r.TaskCount, &r.DoneTasks, &r.OverdueTasks); err != nil {
			return nil, err
		}
		if r.TaskCount > 0 {
			r.Progress = int(float64(r.DoneTasks) / float64(r.TaskCount) * 100)
		}
		r.StatusLabel, _ = mapProjectStatus(r.Status, r.OverdueTasks, r.Progress)
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *Store) ListDeveloperTasks(ctx context.Context, orgID, userID string, limit int) ([]TodayTask, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := s.DB.Query(ctx, `
		SELECT t.id, t.title, COALESCE(p.name,''), t.status, t.priority, t."dueDate"
		FROM "Task" t
		JOIN "Project" p ON p.id=t."projectId"
		WHERE t."orgId"=$1 AND t."deletedAt" IS NULL AND t."assigneeId"=$2
		  AND (
		    t.status IN ('todo','not_started','in_progress','waiting_response','blocked')
		    OR (t.status='done' AND t."updatedAt"::date = CURRENT_DATE)
		  )
		ORDER BY
		  CASE t.status WHEN 'blocked' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'waiting_response' THEN 2
		       WHEN 'todo' THEN 3 WHEN 'not_started' THEN 3 ELSE 4 END,
		  CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
		  t."dueDate" NULLS LAST
		LIMIT $3
	`, orgID, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []TodayTask
	for rows.Next() {
		var t TodayTask
		if err := rows.Scan(&t.ID, &t.Title, &t.ProjectName, &t.Status, &t.Priority, &t.DueDate); err != nil {
			return nil, err
		}
		t.Done = t.Status == "done"
		t.Important = t.Priority == "high" || t.Status == "blocked"
		t.StatusLabel = mapTaskStatus(t.Status)
		out = append(out, t)
	}
	return out, rows.Err()
}

func (s *Store) TeamWorkload(ctx context.Context, orgID, userID string) ([]WorkloadBar, error) {
	// Peers on projects you are assigned to (capacity context only).
	rows, err := s.DB.Query(ctx, `
		SELECT COALESCE(u.name, u.email, 'Dev'), COUNT(*)::int
		FROM "Task" t
		JOIN "User" u ON u.id = t."assigneeId"
		WHERE t."orgId"=$1 AND t."deletedAt" IS NULL
		  AND t.status IN ('todo','not_started','in_progress','waiting_response','blocked')
		  AND t."assigneeId" IS NOT NULL
		  AND t."projectId" IN (
		    SELECT p.id FROM "Project" p
		    WHERE `+assignedProjectWhere+`
		  )
		GROUP BY u.id, u.name, u.email
		ORDER BY COUNT(*) DESC
		LIMIT 8
	`, orgID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	accents := []string{"orange", "dark", "blue", "orange", "dark", "blue", "orange"}
	var out []WorkloadBar
	i := 0
	for rows.Next() {
		var w WorkloadBar
		if err := rows.Scan(&w.Name, &w.Count); err != nil {
			return nil, err
		}
		parts := strings.Fields(w.Name)
		if len(parts) > 0 {
			w.Name = parts[0]
		}
		w.Accent = accents[i%len(accents)]
		out = append(out, w)
		i++
	}
	return out, rows.Err()
}

func (s *Store) ListReports(ctx context.Context, orgID, userID string) ([]ReportRow, error) {
	rows, err := s.DB.Query(ctx, `
		SELECT r.id,
		       COALESCE(NULLIF(left(r."whatWorked", 80), ''), NULLIF(left(r.implemented, 80), ''), 'Daily report'),
		       r."reviewStatus",
		       r."reportDate",
		       r."createdAt"
		FROM "DeveloperReport" r
		WHERE r."orgId"=$1 AND r."submittedById"=$2
		ORDER BY r."reportDate" DESC
		LIMIT 50
	`, orgID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []ReportRow
	for rows.Next() {
		var r ReportRow
		if err := rows.Scan(&r.ID, &r.Title, &r.Status, &r.ReportDate, &r.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *Store) developerHasProjectAccess(ctx context.Context, orgID, userID, projectID string) (bool, error) {
	var ok bool
	err := s.DB.QueryRow(ctx, `
		SELECT EXISTS (
		  SELECT 1 FROM "Project" p
		  WHERE p.id=$3 AND p."orgId"=$1 AND p."deletedAt" IS NULL AND (
		    p."assignedDeveloperId"=$2
		    OR EXISTS (
		      SELECT 1 FROM "ProjectDeveloperAssignment" a
		      WHERE a."projectId"=p.id AND a."userId"=$2 AND a.status='accepted'
		    )
		  )
		)
	`, orgID, userID, projectID).Scan(&ok)
	return ok, err
}

func (s *Store) UpdateTaskStatus(ctx context.Context, orgID, userID, taskID, status string) error {
	status = strings.TrimSpace(strings.ToLower(status))
	switch status {
	case "todo":
		status = "not_started"
	}
	allowed := map[string]bool{
		"not_started": true, "in_progress": true, "waiting_response": true, "blocked": true, "done": true,
	}
	if !allowed[status] {
		return fmt.Errorf("invalid status")
	}

	var projectID string
	var assigneeID *string
	err := s.DB.QueryRow(ctx, `
		SELECT "projectId", "assigneeId" FROM "Task"
		WHERE id=$1 AND "orgId"=$2 AND "deletedAt" IS NULL
	`, taskID, orgID).Scan(&projectID, &assigneeID)
	if err != nil {
		return fmt.Errorf("task not found")
	}

	mine := assigneeID != nil && *assigneeID == userID
	access, err := s.developerHasProjectAccess(ctx, orgID, userID, projectID)
	if err != nil {
		return err
	}
	if !mine && !access {
		return fmt.Errorf("only an accepted developer on this project can update this task")
	}

	ct, err := s.DB.Exec(ctx, `
		UPDATE "Task"
		SET status=$1, "assigneeId"=$2, "updatedAt"=NOW()
		WHERE id=$3 AND "orgId"=$4 AND "deletedAt" IS NULL
	`, status, userID, taskID, orgID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("task not found")
	}
	_, _ = s.DB.Exec(ctx, `
		INSERT INTO "EventLog" (id, "orgId", "actorId", type, "entityType", "entityId", metadata, "createdAt")
		VALUES ($1,$2,$3,'task.status_updated','task',$4,jsonb_build_object('status',$5::text,'source','developer-go'),NOW())
	`, cuid.New(), orgID, userID, taskID, status)
	return nil
}

type ScheduleRow struct {
	ID          string
	Title       string
	Type        string
	Status      string
	ScheduledAt time.Time
	Completed   bool
}

func (s *Store) ListScheduleWeek(ctx context.Context, orgID, userID string) ([]ScheduleRow, error) {
	rows, err := s.DB.Query(ctx, `
		SELECT id, title, type, status, "scheduledAt", ("completedAt" IS NOT NULL OR status='completed')
		FROM "ScheduleItem"
		WHERE "orgId"=$1 AND "userId"=$2
		  AND "scheduledAt" >= date_trunc('week', NOW())
		  AND "scheduledAt" < date_trunc('week', NOW()) + INTERVAL '14 days'
		ORDER BY "scheduledAt" ASC
		LIMIT 50
	`, orgID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []ScheduleRow
	for rows.Next() {
		var r ScheduleRow
		if err := rows.Scan(&r.ID, &r.Title, &r.Type, &r.Status, &r.ScheduledAt, &r.Completed); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *Store) CompleteScheduleItem(ctx context.Context, orgID, userID, id string) error {
	ct, err := s.DB.Exec(ctx, `
		UPDATE "ScheduleItem"
		SET status='completed', "completedAt"=NOW(), "updatedAt"=NOW()
		WHERE id=$1 AND "orgId"=$2 AND "userId"=$3
	`, id, orgID, userID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("schedule item not found")
	}
	return nil
}

type DevReportInput struct {
	WhatWorked     string
	Blockers       string
	NeedsAttention string
	Implemented    string
	Pending        string
	NextPlan       string
}

func (s *Store) CreateDeveloperReport(ctx context.Context, orgID, userID string, in DevReportInput) error {
	trim := func(s string) string { return strings.TrimSpace(s) }
	in.WhatWorked = trim(in.WhatWorked)
	in.Blockers = trim(in.Blockers)
	in.NeedsAttention = trim(in.NeedsAttention)
	in.Implemented = trim(in.Implemented)
	in.Pending = trim(in.Pending)
	in.NextPlan = trim(in.NextPlan)
	bodyLen := len(in.WhatWorked) + len(in.Implemented) + len(in.NextPlan)
	if bodyLen < 60 {
		return fmt.Errorf("report needs more detail (at least ~60 characters across worked / implemented / next plan)")
	}
	id := cuid.New()
	_, err := s.DB.Exec(ctx, `
		INSERT INTO "DeveloperReport" (
		  id, "orgId", "submittedById", "reportDate",
		  "whatWorked", blockers, "needsAttention", implemented, pending, "nextPlan",
		  "reviewStatus", "createdAt", "updatedAt"
		) VALUES (
		  $1,$2,$3, date_trunc('day', NOW()),
		  $4,$5,$6,$7,$8,$9,
		  'pending', NOW(), NOW()
		)
	`, id, orgID, userID, nullEmpty(in.WhatWorked), nullEmpty(in.Blockers), nullEmpty(in.NeedsAttention),
		nullEmpty(in.Implemented), nullEmpty(in.Pending), nullEmpty(in.NextPlan))
	return err
}

func nullEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func mapProjectStatus(status string, overdue, progress int) (label, tone string) {
	s := strings.ToLower(status)
	switch {
	case s == "completed" || s == "done" || s == "closed" || progress >= 100:
		return "Completed", "ok"
	case overdue > 0 || s == "delayed":
		return "Delayed", "warn"
	case s == "at_risk" || s == "blocked":
		return "At risk", "bad"
	default:
		return "On going", "orange"
	}
}

func mapTaskStatus(status string) string {
	switch strings.ToLower(status) {
	case "done":
		return "Approved"
	case "blocked":
		return "In review"
	case "waiting_response":
		return "Waiting"
	case "in_progress":
		return "On going"
	default:
		return "To do"
	}
}

func trendTone(v, good int) string {
	if v >= good {
		return "up"
	}
	if v == 0 {
		return "down"
	}
	return "flat"
}

func maxI(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func maxF(a, b float64) float64 {
	if a > b {
		return a
	}
	return b
}
