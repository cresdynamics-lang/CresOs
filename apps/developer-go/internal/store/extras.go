package store

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/lucsky/cuid"
)

type AssignmentInfo struct {
	AssignmentID string
	Status       string // pending, accepted, declined
}

func (s *Store) GetAssignmentForProject(ctx context.Context, projectID, userID string) (AssignmentInfo, error) {
	var a AssignmentInfo
	err := s.DB.QueryRow(ctx, `
		SELECT id, status FROM "ProjectDeveloperAssignment"
		WHERE "projectId"=$1 AND "userId"=$2
		LIMIT 1
	`, projectID, userID).Scan(&a.AssignmentID, &a.Status)
	return a, err
}

func (s *Store) RespondAssignment(ctx context.Context, orgID, userID, assignmentID string, accept bool) error {
	var projectID, rowUser string
	err := s.DB.QueryRow(ctx, `
		SELECT "projectId", "userId" FROM "ProjectDeveloperAssignment"
		WHERE id=$1 AND "orgId"=$2
	`, assignmentID, orgID).Scan(&projectID, &rowUser)
	if err != nil {
		return fmt.Errorf("assignment not found")
	}
	if rowUser != userID {
		return fmt.Errorf("you can only respond to your own invitation")
	}
	status := "accepted"
	if !accept {
		status = "declined"
	}
	_, err = s.DB.Exec(ctx, `
		UPDATE "ProjectDeveloperAssignment"
		SET status=$1, "respondedAt"=NOW() WHERE id=$2
	`, status, assignmentID)
	if err != nil {
		return err
	}
	if accept {
		_, _ = s.DB.Exec(ctx, `
			UPDATE "Project" SET "assignedDeveloperId"=$1, "updatedAt"=NOW()
			WHERE id=$2 AND "orgId"=$3 AND ("assignedDeveloperId" IS NULL OR "assignedDeveloperId"='')
		`, userID, projectID, orgID)
	}
	return nil
}

type ProjectDetail struct {
	ProjectSummary
	AssignmentID     string
	AssignmentStatus string
	Tasks            []TodayTask
	Description      string
}

func (s *Store) GetProjectDetail(ctx context.Context, orgID, userID, projectID string) (*ProjectDetail, error) {
	rows, err := s.ListProjectSummaries(ctx, orgID, userID, 200)
	if err != nil {
		return nil, err
	}
	var found *ProjectSummary
	for i := range rows {
		if rows[i].ID == projectID {
			found = &rows[i]
			break
		}
	}
	if found == nil {
		return nil, fmt.Errorf("project not found or not assigned to you")
	}
	d := &ProjectDetail{ProjectSummary: *found}
	_ = s.DB.QueryRow(ctx, `SELECT COALESCE("projectDetails",'') FROM "Project" WHERE id=$1`, projectID).Scan(&d.Description)
	if a, err := s.GetAssignmentForProject(ctx, projectID, userID); err == nil {
		d.AssignmentID = a.AssignmentID
		d.AssignmentStatus = a.Status
	}
	trows, err := s.DB.Query(ctx, `
		SELECT t.id, t.title, COALESCE(p.name,''), t.status, t.priority, t."dueDate"
		FROM "Task" t
		JOIN "Project" p ON p.id=t."projectId"
		WHERE t."orgId"=$1 AND t."projectId"=$2 AND t."deletedAt" IS NULL
		  AND (t."assigneeId"=$3 OR t."assigneeId" IS NULL)
		ORDER BY t."updatedAt" DESC
		LIMIT 40
	`, orgID, projectID, userID)
	if err == nil {
		defer trows.Close()
		for trows.Next() {
			var t TodayTask
			if trows.Scan(&t.ID, &t.Title, &t.ProjectName, &t.Status, &t.Priority, &t.DueDate) == nil {
				t.Done = t.Status == "done"
				t.StatusLabel = mapTaskStatus(t.Status)
				d.Tasks = append(d.Tasks, t)
			}
		}
	}
	return d, nil
}

func (s *Store) UpdateTaskStatusFull(ctx context.Context, orgID, userID, taskID, status, blockedReason string) error {
	status = strings.TrimSpace(strings.ToLower(status))
	if status == "todo" {
		status = "not_started"
	}
	allowed := map[string]bool{
		"not_started": true, "in_progress": true, "waiting_response": true, "blocked": true, "done": true,
	}
	if !allowed[status] {
		return fmt.Errorf("invalid status")
	}
	if status == "blocked" && strings.TrimSpace(blockedReason) == "" {
		return fmt.Errorf("blocked reason is required")
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
	br := strings.TrimSpace(blockedReason)
	var brPtr *string
	if status == "blocked" {
		brPtr = &br
	}
	_, err = s.DB.Exec(ctx, `
		UPDATE "Task"
		SET status=$1, "assigneeId"=$2, "blockedReason"=$3, "updatedAt"=NOW()
		WHERE id=$4 AND "orgId"=$5
	`, status, userID, brPtr, taskID, orgID)
	if err != nil {
		return err
	}
	_, _ = s.DB.Exec(ctx, `
		INSERT INTO "EventLog" (id, "orgId", "actorId", type, "entityType", "entityId", metadata, "createdAt")
		VALUES ($1,$2,$3,'task.status_updated','task',$4,jsonb_build_object('status',$5::text,'source','developer-go'),NOW())
	`, cuid.New(), orgID, userID, taskID, status)
	return nil
}

func (s *Store) AddTaskComment(ctx context.Context, orgID, userID, taskID, body, typ string) error {
	body = strings.TrimSpace(body)
	if body == "" {
		return fmt.Errorf("comment required")
	}
	if typ == "" {
		typ = "progress"
	}
	var projectID string
	err := s.DB.QueryRow(ctx, `
		SELECT "projectId" FROM "Task" WHERE id=$1 AND "orgId"=$2 AND "deletedAt" IS NULL
	`, taskID, orgID).Scan(&projectID)
	if err != nil {
		return fmt.Errorf("task not found")
	}
	ok, err := s.developerHasProjectAccess(ctx, orgID, userID, projectID)
	if err != nil || !ok {
		// also allow if assignee
		var assignee *string
		_ = s.DB.QueryRow(ctx, `SELECT "assigneeId" FROM "Task" WHERE id=$1`, taskID).Scan(&assignee)
		if assignee == nil || *assignee != userID {
			return fmt.Errorf("no access to comment on this task")
		}
	}
	_, err = s.DB.Exec(ctx, `
		INSERT INTO "TaskComment" (id, "orgId", "taskId", "authorId", body, type, audience, "createdAt")
		VALUES ($1,$2,$3,$4,$5,$6,'all',NOW())
	`, cuid.New(), orgID, taskID, userID, body, typ)
	return err
}

type PaymentRow struct {
	ID          string
	Amount      float64
	Currency    string
	Description string
	SpentAt     time.Time
}

func (s *Store) ListPendingPayments(ctx context.Context, orgID, userID string) ([]PaymentRow, error) {
	rows, err := s.DB.Query(ctx, `
		SELECT id, amount::float8, currency, COALESCE(description,''), "spentAt"
		FROM "Expense"
		WHERE "orgId"=$1 AND "deletedAt" IS NULL
		  AND category='developer_payment'
		  AND "beneficiaryUserId"=$2
		  AND "developerAcknowledgedAt" IS NULL
		ORDER BY "spentAt" DESC
		LIMIT 20
	`, orgID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []PaymentRow
	for rows.Next() {
		var p PaymentRow
		if rows.Scan(&p.ID, &p.Amount, &p.Currency, &p.Description, &p.SpentAt) == nil {
			out = append(out, p)
		}
	}
	return out, rows.Err()
}

func (s *Store) AcknowledgePayment(ctx context.Context, orgID, userID, expenseID string) error {
	ct, err := s.DB.Exec(ctx, `
		UPDATE "Expense"
		SET "developerAcknowledgedAt"=NOW(), "developerAcknowledgedById"=$1
		WHERE id=$2 AND "orgId"=$3 AND "beneficiaryUserId"=$1
		  AND "developerAcknowledgedAt" IS NULL AND "deletedAt" IS NULL
	`, userID, expenseID, orgID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("payment not found or already acknowledged")
	}
	_, _ = s.DB.Exec(ctx, `
		INSERT INTO "EventLog" (id, "orgId", "actorId", type, "entityType", "entityId", metadata, "createdAt")
		VALUES ($1,$2,$3,'expense.developer_acknowledged','expense',$4,'{}'::jsonb,NOW())
	`, cuid.New(), orgID, userID, expenseID)
	return nil
}

func (s *Store) SnoozeReminder(ctx context.Context, orgID, userID, key, label string, until time.Time) error {
	key = strings.TrimSpace(key)
	if key == "" {
		return fmt.Errorf("reminder key required")
	}
	if label == "" {
		label = "Snoozed"
	}
	_, err := s.DB.Exec(ctx, `
		INSERT INTO "DeveloperReminderSnooze" (id, "orgId", "userId", "reminderKey", "snoozeUntil", label, "createdAt", "updatedAt")
		VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())
		ON CONFLICT ("orgId", "userId", "reminderKey")
		DO UPDATE SET "snoozeUntil"=EXCLUDED."snoozeUntil", label=EXCLUDED.label, "updatedAt"=NOW()
	`, cuid.New(), orgID, userID, key, until, label)
	return err
}
