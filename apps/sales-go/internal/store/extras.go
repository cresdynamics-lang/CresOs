package store

import (
	"context"
	"fmt"
	"strings"
	"time"
)

type WorkPerformance struct {
	UserName       string
	Email          string
	JobTitle       string
	EmploymentType string
	HireDate       *time.Time
	ReportsTo      string
	Status         string
	ReportsDraft   int
	ReportsSubmitted int
	ReportsChecked int
	DealsWon       int
	DealsActive    int
	LeadsOwned     int
	CommsLogged    int
	ProposalsSent  int
	CollectionOpen int
	CollectionDone int
	InvoicesOwned  int
	ProjectsOwned  int
	StreakDays     int
}

type ProjectDelivery struct {
	ID               string
	Name             string
	Status           string
	Priority         string
	ClientName       string
	Progress         int
	MilestonesDone   int
	MilestonesTotal  int
	TasksDone        int
	TasksTotal       int
	EstHours         float64
	ActualHours      float64
	SpeedRatio       float64 // actual/est; <1 faster
	ClientRemarks    int
	LatestRemark     string
	AmountReceived   float64
	Price            float64
	CurrencyHint     string
	StartDate        *time.Time
	EndDate          *time.Time
	PMName           string
	DevName          string
}

type CommunityChannel struct {
	ID          string
	Name        string
	Description string
	Type        string
	IsPublic    bool
	ProjectName string
	UpdatedAt   time.Time
}

type ClientOption struct {
	ID    string
	Name  string
	Email string
}

type ProjectOption struct {
	ID       string
	Name     string
	ClientID string
}

type InvoiceCreateInput struct {
	ClientID  string
	ProjectID string
	IssueDate string
	DueDate   string
	Currency  string
	Notes     string
	Lines     []InvoiceLineInput
}

type InvoiceLineInput struct {
	Description string
	Quantity    int
	UnitPrice   float64
}

func (s *Store) WorkPerformance(ctx context.Context, orgID, userID string) (*WorkPerformance, error) {
	w := &WorkPerformance{}
	err := s.DB.QueryRow(ctx, `
		SELECT COALESCE(u.name,''), u.email, COALESCE(u."jobTitle",''), COALESCE(u."employmentType",'full_time'),
		       u."hireDate", COALESCE(u.status,'active'), COALESCE(d.name, d.email, '')
		FROM "User" u
		LEFT JOIN "User" d ON d.id = u."reportsToDirectorId"
		WHERE u.id=$1 AND (u."orgId"=$2 OR u."orgId" IS NULL)
	`, userID, orgID).Scan(&w.UserName, &w.Email, &w.JobTitle, &w.EmploymentType, &w.HireDate, &w.Status, &w.ReportsTo)
	if err != nil {
		return nil, err
	}

	_ = s.DB.QueryRow(ctx, `SELECT COUNT(*) FROM "SalesReport" WHERE "orgId"=$1 AND "submittedById"=$2 AND status='draft'`, orgID, userID).Scan(&w.ReportsDraft)
	_ = s.DB.QueryRow(ctx, `SELECT COUNT(*) FROM "SalesReport" WHERE "orgId"=$1 AND "submittedById"=$2 AND status='submitted'`, orgID, userID).Scan(&w.ReportsSubmitted)
	_ = s.DB.QueryRow(ctx, `SELECT COUNT(*) FROM "SalesReport" WHERE "orgId"=$1 AND "submittedById"=$2 AND "reviewStatus"='checked'`, orgID, userID).Scan(&w.ReportsChecked)
	_ = s.DB.QueryRow(ctx, `SELECT COUNT(*) FROM "Deal" WHERE "orgId"=$1 AND "ownerId"=$2 AND "deletedAt" IS NULL AND stage='won'`, orgID, userID).Scan(&w.DealsWon)
	_ = s.DB.QueryRow(ctx, `SELECT COUNT(*) FROM "Deal" WHERE "orgId"=$1 AND "ownerId"=$2 AND "deletedAt" IS NULL AND stage NOT IN ('won','lost')`, orgID, userID).Scan(&w.DealsActive)
	_ = s.DB.QueryRow(ctx, `SELECT COUNT(*) FROM "Lead" WHERE "orgId"=$1 AND "ownerId"=$2 AND "deletedAt" IS NULL`, orgID, userID).Scan(&w.LeadsOwned)
	_ = s.DB.QueryRow(ctx, `
		SELECT COUNT(*) FROM "DealActivity" da JOIN "Deal" d ON d.id=da."dealId"
		WHERE da."orgId"=$1 AND d."ownerId"=$2
		  AND da.type IN ('follow_up','negotiation','close','lost','call','meeting','whatsapp','email','note')
	`, orgID, userID).Scan(&w.CommsLogged)
	_ = s.DB.QueryRow(ctx, `
		SELECT COUNT(*) FROM "DealActivity" da JOIN "Deal" d ON d.id=da."dealId"
		WHERE da."orgId"=$1 AND d."ownerId"=$2 AND da.type='proposal'
	`, orgID, userID).Scan(&w.ProposalsSent)
	_ = s.DB.QueryRow(ctx, `SELECT COUNT(*) FROM "InvoiceCollectionTask" WHERE "orgId"=$1 AND "assignedToId"=$2 AND status='open'`, orgID, userID).Scan(&w.CollectionOpen)
	_ = s.DB.QueryRow(ctx, `SELECT COUNT(*) FROM "InvoiceCollectionTask" WHERE "orgId"=$1 AND "assignedToId"=$2 AND status='reached'`, orgID, userID).Scan(&w.CollectionDone)
	_ = s.DB.QueryRow(ctx, `
		SELECT COUNT(*) FROM "Invoice" i
		WHERE i."orgId"=$1 AND i."deletedAt" IS NULL AND EXISTS (
			SELECT 1 FROM "Project" p WHERE p.id=i."projectId" AND (p."ownerUserId"=$2 OR p."createdByUserId"=$2)
		)
	`, orgID, userID).Scan(&w.InvoicesOwned)
	_ = s.DB.QueryRow(ctx, `
		SELECT COUNT(*) FROM "Project"
		WHERE "orgId"=$1 AND "deletedAt" IS NULL AND ("ownerUserId"=$2 OR "createdByUserId"=$2)
	`, orgID, userID).Scan(&w.ProjectsOwned)

	_ = s.DB.QueryRow(ctx, `
		SELECT COUNT(DISTINCT date_trunc('day', COALESCE("submittedAt","createdAt")))
		FROM "SalesReport"
		WHERE "orgId"=$1 AND "submittedById"=$2 AND status='submitted'
		  AND COALESCE("submittedAt","createdAt") >= NOW() - INTERVAL '14 days'
	`, orgID, userID).Scan(&w.StreakDays)
	return w, nil
}

func (s *Store) ListProjectDelivery(ctx context.Context, orgID, userID string, isAdmin bool) ([]ProjectDelivery, error) {
	where := `p."orgId"=$1 AND p."deletedAt" IS NULL`
	args := []any{orgID}
	if !isAdmin {
		where += ` AND (p."ownerUserId"=$2 OR p."createdByUserId"=$2 OR p."dealId" IN (
			SELECT id FROM "Deal" WHERE "orgId"=$1 AND "ownerId"=$2 AND "deletedAt" IS NULL
		))`
		args = append(args, userID)
	}
	rows, err := s.DB.Query(ctx, `
		SELECT p.id, p.name, p.status, COALESCE(p.priority,'medium'),
		       COALESCE(c.name, p."clientOrOwnerName", '—'),
		       COALESCE(p."managementProgressPercent", 0),
		       COALESCE(p."amountReceived",0)::float8, COALESCE(p.price,0)::float8,
		       p."startDate", p."endDate",
		       COALESCE(pm.name, pm.email, ''),
		       COALESCE(dev.name, dev.email, '')
		FROM "Project" p
		LEFT JOIN "Client" c ON c.id = p."clientId"
		LEFT JOIN "User" pm ON pm.id = p."projectManagerUserId"
		LEFT JOIN "User" dev ON dev.id = p."assignedDeveloperId"
		WHERE `+where+`
		ORDER BY p."updatedAt" DESC
		LIMIT 50
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []ProjectDelivery
	for rows.Next() {
		var p ProjectDelivery
		if err := rows.Scan(
			&p.ID, &p.Name, &p.Status, &p.Priority, &p.ClientName, &p.Progress,
			&p.AmountReceived, &p.Price, &p.StartDate, &p.EndDate, &p.PMName, &p.DevName,
		); err != nil {
			return nil, err
		}
		p.CurrencyHint = "KES"
		_ = s.DB.QueryRow(ctx, `
			SELECT COUNT(*) FILTER (WHERE status='completed'), COUNT(*)
			FROM "Milestone" WHERE "projectId"=$1 AND "deletedAt" IS NULL
		`, p.ID).Scan(&p.MilestonesDone, &p.MilestonesTotal)
		_ = s.DB.QueryRow(ctx, `
			SELECT COUNT(*) FILTER (WHERE status='done'), COUNT(*),
			       COALESCE(SUM("estimatedHours"),0)::float8, COALESCE(SUM("actualHours"),0)::float8
			FROM "Task" WHERE "projectId"=$1 AND "deletedAt" IS NULL
		`, p.ID).Scan(&p.TasksDone, &p.TasksTotal, &p.EstHours, &p.ActualHours)
		if p.EstHours > 0 {
			p.SpeedRatio = p.ActualHours / p.EstHours
		}
		_ = s.DB.QueryRow(ctx, `
			SELECT COUNT(*) FROM "ProjectPlanningNote"
			WHERE "projectId"=$1 AND source='client_remark'
		`, p.ID).Scan(&p.ClientRemarks)
		_ = s.DB.QueryRow(ctx, `
			SELECT COALESCE("rawText",'') FROM "ProjectPlanningNote"
			WHERE "projectId"=$1 AND source='client_remark'
			ORDER BY "createdAt" DESC LIMIT 1
		`, p.ID).Scan(&p.LatestRemark)
		if len(p.LatestRemark) > 160 {
			p.LatestRemark = p.LatestRemark[:157] + "…"
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *Store) ListCommunityChannels(ctx context.Context, orgID string) ([]CommunityChannel, error) {
	rows, err := s.DB.Query(ctx, `
		SELECT ch.id, ch.name, COALESCE(ch.description,''), ch.type, ch."isPublic",
		       COALESCE(p.name,''), ch."updatedAt"
		FROM "ChatCommunityChannel" ch
		LEFT JOIN "Project" p ON p.id = ch."projectId"
		WHERE ch."orgId"=$1
		ORDER BY ch."updatedAt" DESC
		LIMIT 100
	`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []CommunityChannel
	for rows.Next() {
		var c CommunityChannel
		if err := rows.Scan(&c.ID, &c.Name, &c.Description, &c.Type, &c.IsPublic, &c.ProjectName, &c.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Store) ListClientOptions(ctx context.Context, orgID string) ([]ClientOption, error) {
	rows, err := s.DB.Query(ctx, `
		SELECT id, name, COALESCE(email,'') FROM "Client"
		WHERE "orgId"=$1 AND "deletedAt" IS NULL
		ORDER BY name ASC
	`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []ClientOption
	for rows.Next() {
		var c ClientOption
		if err := rows.Scan(&c.ID, &c.Name, &c.Email); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Store) ListProjectOptions(ctx context.Context, orgID, userID string, isAdmin bool) ([]ProjectOption, error) {
	where := `"orgId"=$1 AND "deletedAt" IS NULL`
	args := []any{orgID}
	if !isAdmin {
		where += ` AND ("ownerUserId"=$2 OR "createdByUserId"=$2)`
		args = append(args, userID)
	}
	rows, err := s.DB.Query(ctx, `
		SELECT id, name, COALESCE("clientId",'') FROM "Project"
		WHERE `+where+`
		ORDER BY name ASC
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []ProjectOption
	for rows.Next() {
		var p ProjectOption
		if err := rows.Scan(&p.ID, &p.Name, &p.ClientID); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *Store) CreateSalesInvoice(ctx context.Context, orgID, userID string, in InvoiceCreateInput, isAdmin bool) (string, string, error) {
	clientID := strings.TrimSpace(in.ClientID)
	projectID := strings.TrimSpace(in.ProjectID)
	if clientID == "" {
		return "", "", fmt.Errorf("client is required")
	}
	if !isAdmin && projectID == "" {
		return "", "", fmt.Errorf("project is required")
	}
	var lines []InvoiceLineInput
	for _, ln := range in.Lines {
		desc := strings.TrimSpace(ln.Description)
		if desc == "" || ln.UnitPrice <= 0 {
			continue
		}
		qty := ln.Quantity
		if qty < 1 {
			qty = 1
		}
		lines = append(lines, InvoiceLineInput{Description: desc, Quantity: qty, UnitPrice: ln.UnitPrice})
	}
	if len(lines) == 0 {
		return "", "", fmt.Errorf("add at least one line item")
	}

	if projectID != "" {
		var ok int
		q := `SELECT 1 FROM "Project" WHERE id=$1 AND "orgId"=$2 AND "deletedAt" IS NULL`
		args := []any{projectID, orgID}
		if !isAdmin {
			q += ` AND ("ownerUserId"=$3 OR "createdByUserId"=$3)`
			args = append(args, userID)
		}
		if err := s.DB.QueryRow(ctx, q, args...).Scan(&ok); err != nil {
			return "", "", fmt.Errorf("project not found or not allowed")
		}
		var projClient *string
		_ = s.DB.QueryRow(ctx, `SELECT "clientId" FROM "Project" WHERE id=$1`, projectID).Scan(&projClient)
		if projClient != nil && *projClient != "" && *projClient != clientID {
			return "", "", fmt.Errorf("client must match the project client")
		}
	}

	issue := time.Now()
	if strings.TrimSpace(in.IssueDate) != "" {
		if t, err := time.Parse("2006-01-02", in.IssueDate); err == nil {
			issue = t
		}
	}
	var due *time.Time
	if strings.TrimSpace(in.DueDate) != "" {
		if t, err := time.Parse("2006-01-02", in.DueDate); err == nil {
			due = &t
		}
	}
	currency := strings.TrimSpace(in.Currency)
	if currency == "" {
		currency = "KES"
	}
	var total float64
	for _, ln := range lines {
		total += float64(ln.Quantity) * ln.UnitPrice
	}

	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return "", "", err
	}
	defer tx.Rollback(ctx)

	number := ""
	yy := issue.Year() % 100
	if projectID != "" {
		var seq, refYear, nextOrd *int
		err = tx.QueryRow(ctx, `
			SELECT "financeProjectSeq", "financeRefYear", "nextInvoiceOrdinal"
			FROM "Project" WHERE id=$1 AND "orgId"=$2 AND "deletedAt" IS NULL
		`, projectID, orgID).Scan(&seq, &refYear, &nextOrd)
		if err == nil && seq != nil && refYear != nil && nextOrd != nil {
			number = fmt.Sprintf("%03d/%02d/%02d", *seq, *nextOrd, *refYear%100)
			if _, err = tx.Exec(ctx, `UPDATE "Project" SET "nextInvoiceOrdinal"=$1 WHERE id=$2`, *nextOrd+1, projectID); err != nil {
				return "", "", err
			}
		}
	}
	if number == "" {
		var count int
		if err = tx.QueryRow(ctx, `SELECT COUNT(*) FROM "Invoice" WHERE "orgId"=$1`, orgID).Scan(&count); err != nil {
			return "", "", err
		}
		number = fmt.Sprintf("CD-INV-%06d/%02d", count+1, yy)
	}

	invID := newID()
	_, err = tx.Exec(ctx, `
		INSERT INTO "Invoice"
			(id, "orgId", "clientId", "projectId", number, status, "issueDate", "dueDate", currency, "totalAmount", notes, "createdAt", "updatedAt")
		VALUES ($1,$2,$3,NULLIF($4,''),$5,'sent',$6,$7,$8,$9,NULLIF($10,''),NOW(),NOW())
	`, invID, orgID, clientID, projectID, number, issue, due, currency, total, strings.TrimSpace(in.Notes))
	if err != nil {
		return "", "", err
	}
	for _, ln := range lines {
		_, err = tx.Exec(ctx, `
			INSERT INTO "InvoiceItem" (id, "invoiceId", description, quantity, "unitPrice")
			VALUES ($1,$2,$3,$4,$5)
		`, newID(), invID, ln.Description, ln.Quantity, ln.UnitPrice)
		if err != nil {
			return "", "", err
		}
	}
	_, _ = tx.Exec(ctx, `
		INSERT INTO "EventLog" (id, "orgId", "actorId", type, "entityType", "entityId", metadata, "createdAt")
		VALUES ($1,$2,$3,'invoice.sent','invoice',$4,jsonb_build_object('number',$5::text,'source','sales-go'),NOW())
	`, newID(), orgID, userID, invID, number)
	if err := tx.Commit(ctx); err != nil {
		return "", "", err
	}
	_ = s.EscalateInvoiceCollection(ctx, orgID, invID, userID, "invoice_created")
	return invID, number, nil
}

type ProjectCreateInput struct {
	Name                 string
	Type                 string // demo | project
	ClientID             string
	ClientOrOwnerName    string
	Phone                string
	Email                string
	Price                string
	ProjectDetails       string
	SuccessCriteria      string
	StartDate            string
	EndDate              string
	AssignedDeveloperID  string
}

type DeveloperOption struct {
	ID   string
	Name string
}

func (s *Store) ListAssignableDevelopers(ctx context.Context, orgID string) ([]DeveloperOption, error) {
	rows, err := s.DB.Query(ctx, `
		SELECT DISTINCT u.id, COALESCE(NULLIF(u.name,''), u.email)
		FROM "User" u
		JOIN "UserRole" ur ON ur."userId"=u.id
		JOIN "Role" r ON r.id=ur."roleId"
		WHERE r."orgId"=$1 AND r.key='developer' AND u."deletedAt" IS NULL
		ORDER BY 2
	`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []DeveloperOption
	for rows.Next() {
		var d DeveloperOption
		if rows.Scan(&d.ID, &d.Name) == nil {
			out = append(out, d)
		}
	}
	return out, rows.Err()
}

func (s *Store) CreateSalesProject(ctx context.Context, orgID, userID string, in ProjectCreateInput) (string, string, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return "", "", fmt.Errorf("project name is required")
	}
	typ := strings.TrimSpace(in.Type)
	if typ != "demo" && typ != "project" {
		return "", "", fmt.Errorf("type must be demo or project")
	}
	clientID := strings.TrimSpace(in.ClientID)
	start := time.Now()
	if strings.TrimSpace(in.StartDate) != "" {
		if t, err := time.Parse("2006-01-02", in.StartDate); err == nil {
			start = t
		}
	}
	var end *time.Time
	if strings.TrimSpace(in.EndDate) != "" {
		if t, err := time.Parse("2006-01-02", in.EndDate); err == nil {
			end = &t
		}
	}
	var price any
	if strings.TrimSpace(in.Price) != "" {
		var v float64
		fmt.Sscanf(strings.TrimSpace(strings.ReplaceAll(in.Price, ",", "")), "%f", &v)
		price = v
	} else {
		price = nil
	}

	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return "", "", err
	}
	defer tx.Rollback(ctx)

	var maxSeq *int
	_ = tx.QueryRow(ctx, `SELECT MAX("financeProjectSeq") FROM "Project" WHERE "orgId"=$1`, orgID).Scan(&maxSeq)
	seq := 1
	if maxSeq != nil {
		seq = *maxSeq + 1
	}
	refYear := time.Now().Year()
	id := newID()
	_, err = tx.Exec(ctx, `
		INSERT INTO "Project" (
			id, "orgId", name, status, priority, "ownerUserId", "createdByUserId",
			"clientId", "startDate", "endDate", type, "clientOrOwnerName", phone, email,
			price, "projectDetails", "successCriteria", "approvalStatus",
			"assignedDeveloperId",
			"financeProjectSeq", "financeRefYear", "nextInvoiceOrdinal",
			"managementActive", "amountReceived", "createdAt", "updatedAt"
		) VALUES (
			$1,$2,$3,'planned','medium',$4,$4,
			NULLIF($5,''),$6,$7,$8,NULLIF($9,''),NULLIF($10,''),NULLIF($11,''),
			$12,NULLIF($13,''),NULLIF($14,''),'pending_approval',
			NULLIF($15,''),
			$16,$17,1,
			false,0,NOW(),NOW()
		)
	`, id, orgID, name, userID,
		clientID, start, end, typ, strings.TrimSpace(in.ClientOrOwnerName), strings.TrimSpace(in.Phone), strings.TrimSpace(in.Email),
		price, strings.TrimSpace(in.ProjectDetails), strings.TrimSpace(in.SuccessCriteria),
		strings.TrimSpace(in.AssignedDeveloperID),
		seq, refYear)
	if err != nil {
		return "", "", err
	}
	if devID := strings.TrimSpace(in.AssignedDeveloperID); devID != "" {
		_, _ = tx.Exec(ctx, `
			INSERT INTO "ProjectDeveloperAssignment" (
				id, "orgId", "projectId", "userId", status, "invitedById", "createdAt"
			) VALUES ($1,$2,$3,$4,'pending',$5,NOW())
			ON CONFLICT ("projectId", "userId") DO UPDATE
			SET status='pending', "invitedById"=EXCLUDED."invitedById"
		`, newID(), orgID, id, devID, userID)
	}
	_, _ = tx.Exec(ctx, `
		INSERT INTO "EventLog" (id, "orgId", "actorId", type, "entityType", "entityId", metadata, "createdAt")
		VALUES ($1,$2,$3,'project.created','project',$4,
		        jsonb_build_object('name',$5::text,'type',$6::text,'source','sales-go','approvalStatus','pending_approval'),
		        NOW())
	`, newID(), orgID, userID, id, name, typ)

	nRows, nErr := tx.Query(ctx, `
		SELECT DISTINCT u.id FROM "User" u
		JOIN "UserRole" ur ON ur."userId"=u.id
		JOIN "Role" r ON r.id=ur."roleId"
		WHERE r."orgId"=$1 AND r.key IN ('director_admin','admin') AND u."deletedAt" IS NULL
	`, orgID)
	if nErr == nil {
		defer nRows.Close()
		for nRows.Next() {
			var to string
			if nRows.Scan(&to) != nil {
				continue
			}
			_, _ = tx.Exec(ctx, `
				INSERT INTO "Notification" (id, "orgId", channel, "to", subject, body, status, type, tier, "createdAt")
				VALUES ($1,$2,'in_app',$3,$4,$5,'sent','project.pending_approval','governance',NOW())
			`, newID(), orgID, to,
				fmt.Sprintf("Project pending · %s", name),
				fmt.Sprintf("Sales submitted %s project \"%s\" for director approval.", typ, name))
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return "", "", err
	}
	return id, name, nil
}

type OrgPerson struct {
	ID    string
	Name  string
	Email string
}

type DirectChatRow struct {
	ID       string
	PeerName string
	Preview  string
}

func (s *Store) ListOrgPeople(ctx context.Context, orgID, excludeUserID string) ([]OrgPerson, error) {
	rows, err := s.DB.Query(ctx, `
		SELECT DISTINCT u.id, COALESCE(u.name, u.email), u.email
		FROM "User" u
		JOIN "UserRole" ur ON ur."userId"=u.id
		JOIN "Role" r ON r.id=ur."roleId"
		WHERE r."orgId"=$1 AND u."deletedAt" IS NULL AND u.id <> $2 AND u.status='active'
		ORDER BY 2 ASC
		LIMIT 200
	`, orgID, excludeUserID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []OrgPerson
	for rows.Next() {
		var p OrgPerson
		if err := rows.Scan(&p.ID, &p.Name, &p.Email); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *Store) ListDirectChats(ctx context.Context, orgID, userID string) ([]DirectChatRow, error) {
	rows, err := s.DB.Query(ctx, `
		SELECT c.id,
		       COALESCE(c."lastMessage"->>'content', 'No messages yet'),
		       c.participants
		FROM "Conversation" c
		WHERE c."orgId"=$1 AND c.type='direct' AND $2 = ANY(c.participants)
		ORDER BY c."updatedAt" DESC
		LIMIT 40
	`, orgID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []DirectChatRow
	for rows.Next() {
		var id, preview string
		var parts []string
		if err := rows.Scan(&id, &preview, &parts); err != nil {
			return nil, err
		}
		peerID := ""
		for _, p := range parts {
			if p != userID {
				peerID = p
				break
			}
		}
		peerName := "Teammate"
		if peerID != "" {
			_ = s.DB.QueryRow(ctx, `SELECT COALESCE(name, email) FROM "User" WHERE id=$1`, peerID).Scan(&peerName)
		}
		out = append(out, DirectChatRow{ID: id, PeerName: peerName, Preview: preview})
	}
	return out, rows.Err()
}

func (s *Store) ensureChatUser(ctx context.Context, orgID, userID string) error {
	var exists int
	err := s.DB.QueryRow(ctx, `SELECT 1 FROM "ChatUser" WHERE "userId"=$1`, userID).Scan(&exists)
	if err == nil {
		return nil
	}
	var name, email string
	if err := s.DB.QueryRow(ctx, `SELECT COALESCE(name,''), email FROM "User" WHERE id=$1`, userID).Scan(&name, &email); err != nil {
		return err
	}
	display := name
	if display == "" {
		display = email
	}
	username := fmt.Sprintf("u_%s", userID)
	if len(username) > 40 {
		username = username[:40]
	}
	_, err = s.DB.Exec(ctx, `
		INSERT INTO "ChatUser" (id, "userId", "orgId", username, "displayName", status, "isOnline", "lastSeen", preferences, "createdAt", "updatedAt")
		VALUES ($1,$2,$3,$4,$5,'offline',false,NOW(),'{"notifications":true,"soundEnabled":true,"doNotDisturb":false}'::jsonb,NOW(),NOW())
		ON CONFLICT ("userId") DO NOTHING
	`, newID(), userID, orgID, username, display)
	if err != nil {
		return err
	}
	_, _ = s.DB.Exec(ctx, `
		INSERT INTO "Inbox" (id, "userId", "orgId", conversations, "unreadCount", "lastActivity", settings, "createdAt", "updatedAt")
		VALUES ($1,$2,$3,ARRAY[]::text[],0,NOW(),'{"archiveRead":false,"hideOffline":false,"sortBy":"recent"}'::jsonb,NOW(),NOW())
		ON CONFLICT ("userId") DO NOTHING
	`, newID(), userID, orgID)
	return nil
}

func (s *Store) StartDirectChat(ctx context.Context, orgID, fromID, toID, message string) (string, error) {
	message = strings.TrimSpace(message)
	toID = strings.TrimSpace(toID)
	if toID == "" || toID == fromID {
		return "", fmt.Errorf("pick a teammate")
	}
	if message == "" {
		return "", fmt.Errorf("message is required")
	}
	var ok int
	if err := s.DB.QueryRow(ctx, `
		SELECT 1 FROM "User" u
		JOIN "UserRole" ur ON ur."userId"=u.id
		JOIN "Role" r ON r.id=ur."roleId"
		WHERE u.id=$1 AND r."orgId"=$2 AND u."deletedAt" IS NULL
	`, toID, orgID).Scan(&ok); err != nil {
		return "", fmt.Errorf("teammate not found")
	}
	if err := s.ensureChatUser(ctx, orgID, fromID); err != nil {
		return "", err
	}
	if err := s.ensureChatUser(ctx, orgID, toID); err != nil {
		return "", err
	}

	var convID string
	err := s.DB.QueryRow(ctx, `
		SELECT id FROM "Conversation"
		WHERE "orgId"=$1 AND type='direct' AND $2 = ANY(participants) AND $3 = ANY(participants)
		LIMIT 1
	`, orgID, fromID, toID).Scan(&convID)
	if err != nil {
		convID = newID()
		_, err = s.DB.Exec(ctx, `
			INSERT INTO "Conversation"
				(id, "orgId", type, "createdBy", participants, admins, settings, "unreadCounts", "createdAt", "updatedAt")
			VALUES (
				$1,$2,'direct',$3,ARRAY[$3,$4]::text[],ARRAY[$3]::text[],
				'{"isPublic":false,"allowInvites":false,"readOnly":false,"archived":false}'::jsonb,
				jsonb_build_object($3::text,0,$4::text,1),
				NOW(),NOW()
			)
		`, convID, orgID, fromID, toID)
		if err != nil {
			return "", err
		}
	}

	msgID := newID()
	_, err = s.DB.Exec(ctx, `
		INSERT INTO "Message" (id, "conversationId", "senderId", content, type, status, reactions, "readBy", "createdAt", "updatedAt")
		VALUES ($1,$2,$3,$4,'text','sent','[]'::jsonb,'[]'::jsonb,NOW(),NOW())
	`, msgID, convID, fromID, message)
	if err != nil {
		return "", err
	}
	_, _ = s.DB.Exec(ctx, `
		UPDATE "Conversation"
		SET "lastMessage"=jsonb_build_object('id',$1::text,'content',$2::text,'senderId',$3::text,'timestamp',NOW(),'type','text'),
		    "updatedAt"=NOW(),
		    "unreadCounts"=COALESCE("unreadCounts",'{}'::jsonb) || jsonb_build_object($4::text, COALESCE(("unreadCounts"->>$4)::int,0)+1)
		WHERE id=$5
	`, msgID, message, fromID, toID, convID)

	_, _ = s.DB.Exec(ctx, `
		INSERT INTO "Notification" (id, "orgId", channel, "to", subject, body, status, type, tier, "createdAt")
		VALUES ($1,$2,'in_app',$3,'New chat message',$4,'sent','chat.direct.message','execution',NOW())
	`, newID(), orgID, toID, message)
	return convID, nil
}

func (s *Store) CreateLead(ctx context.Context, orgID, userID, title, source string) (string, error) {
	title = strings.TrimSpace(title)
	if title == "" {
		return "", fmt.Errorf("title is required")
	}
	id := newID()
	_, err := s.DB.Exec(ctx, `
		INSERT INTO "Lead" (id, "orgId", title, source, status, "ownerId", "approvalStatus", "createdAt", "updatedAt")
		VALUES ($1,$2,$3,NULLIF($4,''),'new',$5,'pending_approval',NOW(),NOW())
	`, id, orgID, title, strings.TrimSpace(source), userID)
	if err != nil {
		return "", err
	}
	_, _ = s.DB.Exec(ctx, `
		INSERT INTO "Notification" (id, "orgId", channel, "to", subject, body, status, type, tier, "createdAt")
		SELECT $1, $2, 'in_app', u.id, $3, $4, 'sent', 'lead.created', 'execution', NOW()
		FROM "User" u
		JOIN "UserRole" ur ON ur."userId"=u.id
		JOIN "Role" r ON r.id=ur."roleId"
		WHERE r."orgId"=$2 AND r.key IN ('director_admin','admin') AND u."deletedAt" IS NULL
	`, newID(), orgID, "New lead created", fmt.Sprintf("Lead %q was added and is pending approval.", title))
	return id, nil
}

func (s *Store) UpdateLeadStatus(ctx context.Context, orgID, userID, leadID, status string, isAdmin bool) error {
	status = strings.TrimSpace(strings.ToLower(status))
	allowed := map[string]bool{
		"new": true, "contacted": true, "qualified": true, "disqualified": true,
		"waiting": true, "scheduled": true, "closed": true,
	}
	if !allowed[status] {
		return fmt.Errorf("invalid status")
	}
	where := `id=$1 AND "orgId"=$2 AND "deletedAt" IS NULL`
	args := []any{leadID, orgID, status}
	if !isAdmin {
		where += ` AND "ownerId"=$4`
		args = append(args, userID)
	}
	ct, err := s.DB.Exec(ctx, fmt.Sprintf(`UPDATE "Lead" SET status=$3, "updatedAt"=NOW() WHERE %s`, where), args...)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("lead not found")
	}
	return nil
}

type LeadDetail struct {
	LeadRow
	Comments []LeadComment
}

type LeadComment struct {
	ID         string
	Content    string
	AuthorName string
	CreatedAt  time.Time
}

func (s *Store) GetLead(ctx context.Context, orgID, userID, leadID string, isAdmin bool) (*LeadDetail, error) {
	where := `l.id=$1 AND l."orgId"=$2 AND l."deletedAt" IS NULL`
	args := []any{leadID, orgID}
	if !isAdmin {
		where += ` AND l."ownerId"=$3`
		args = append(args, userID)
	}
	var d LeadDetail
	err := s.DB.QueryRow(ctx, `
		SELECT l.id, l.title, l.status, l."approvalStatus", COALESCE(l.source,''),
		       COALESCE(u.name, u.email, ''), l."createdAt"
		FROM "Lead" l
		LEFT JOIN "User" u ON u.id=l."ownerId"
		WHERE `+where, args...).Scan(
		&d.ID, &d.Title, &d.Status, &d.ApprovalStatus, &d.Source, &d.OwnerName, &d.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("lead not found")
	}
	rows, err := s.DB.Query(ctx, `
		SELECT c.id, c.content, COALESCE(u.name, u.email, ''), c."createdAt"
		FROM "LeadComment" c
		JOIN "User" u ON u.id=c."authorId"
		WHERE c."leadId"=$1 AND c."orgId"=$2
		ORDER BY c."createdAt" ASC
	`, leadID, orgID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var c LeadComment
			if rows.Scan(&c.ID, &c.Content, &c.AuthorName, &c.CreatedAt) == nil {
				d.Comments = append(d.Comments, c)
			}
		}
	}
	return &d, nil
}

func (s *Store) AddLeadComment(ctx context.Context, orgID, userID, leadID, content string) error {
	content = strings.TrimSpace(content)
	if content == "" {
		return fmt.Errorf("comment required")
	}
	_, err := s.DB.Exec(ctx, `
		INSERT INTO "LeadComment" (id, "leadId", "orgId", "authorId", content, "createdAt")
		VALUES ($1,$2,$3,$4,$5,NOW())
	`, newID(), leadID, orgID, userID, content)
	return err
}

func (s *Store) CreateContact(ctx context.Context, orgID, userID, name, email, phone string) (string, error) {
	email = strings.TrimSpace(email)
	phone = strings.TrimSpace(phone)
	name = strings.TrimSpace(name)
	if email == "" && phone == "" {
		return "", fmt.Errorf("email or phone required")
	}
	id := newID()
	_, err := s.DB.Exec(ctx, `
		INSERT INTO "CrmContact" (id, "orgId", email, phone, name, "addedById", "createdAt")
		VALUES ($1,$2,NULLIF($3,''),NULLIF($4,''),NULLIF($5,''),$6,NOW())
	`, id, orgID, email, phone, name, userID)
	return id, err
}

func (s *Store) DeleteContact(ctx context.Context, orgID, contactID string) error {
	ct, err := s.DB.Exec(ctx, `
		UPDATE "CrmContact" SET "deletedAt"=NOW() WHERE id=$1 AND "orgId"=$2 AND "deletedAt" IS NULL
	`, contactID, orgID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("contact not found")
	}
	return nil
}

func (s *Store) QueueOutboundMail(ctx context.Context, orgID, userID, to, subject, body string) error {
	to = strings.TrimSpace(to)
	subject = strings.TrimSpace(subject)
	body = strings.TrimSpace(body)
	if to == "" || subject == "" || body == "" {
		return fmt.Errorf("to, subject, and body are required")
	}
	nid := newID()
	_, err := s.DB.Exec(ctx, `
		INSERT INTO "Notification" (id, "orgId", channel, "to", subject, body, status, type, tier, "createdAt")
		VALUES ($1,$2,'email',$3,$4,$5,'queued','sales.mail.send','execution',NOW())
	`, nid, orgID, to, subject, body)
	if err != nil {
		return err
	}
	_, _ = s.DB.Exec(ctx, `
		INSERT INTO "EventLog" (id, "orgId", "actorId", type, "entityType", "entityId", metadata, "createdAt")
		VALUES ($1,$2,$3,'sales.mail.send','notification',$4,
		        jsonb_build_object('to',$5::text,'subject',$6::text,'notificationId',$4::text), NOW())
	`, newID(), orgID, userID, nid, to, subject)
	return nil
}

func (s *Store) BulkQueueMail(ctx context.Context, orgID, userID string, contactIDs []string, subject, body string) (int, error) {
	subject = strings.TrimSpace(subject)
	body = strings.TrimSpace(body)
	if subject == "" || body == "" {
		return 0, fmt.Errorf("subject and body required")
	}
	n := 0
	for _, id := range contactIDs {
		id = strings.TrimSpace(id)
		if id == "" {
			continue
		}
		var email string
		err := s.DB.QueryRow(ctx, `
			SELECT COALESCE(email,'') FROM "CrmContact"
			WHERE id=$1 AND "orgId"=$2 AND "deletedAt" IS NULL
		`, id, orgID).Scan(&email)
		if err != nil || email == "" {
			continue
		}
		if s.QueueOutboundMail(ctx, orgID, userID, email, subject, body) == nil {
			n++
		}
	}
	if n == 0 {
		return 0, fmt.Errorf("no contacts with email selected")
	}
	return n, nil
}

type ReportComment struct {
	ID         string
	Kind       string
	Content    string
	AuthorName string
	CreatedAt  time.Time
	ParentID   *string
}

type ReportDetail struct {
	ReportRow
	Body     string
	Comments []ReportComment
}

func (s *Store) GetReport(ctx context.Context, orgID, userID, reportID string, isAdmin bool) (*ReportDetail, error) {
	where := `r.id=$1 AND r."orgId"=$2`
	args := []any{reportID, orgID}
	if !isAdmin {
		where += ` AND r."submittedById"=$3`
		args = append(args, userID)
	}
	var d ReportDetail
	err := s.DB.QueryRow(ctx, `
		SELECT r.id, r.title, r.status, r."reviewStatus", r."submittedAt", r."createdAt",
		       COALESCE(u.name, u.email, ''), r.body
		FROM "SalesReport" r
		JOIN "User" u ON u.id=r."submittedById"
		WHERE `+where, args...).Scan(
		&d.ID, &d.Title, &d.Status, &d.ReviewStatus, &d.SubmittedAt, &d.CreatedAt, &d.AuthorName, &d.Body,
	)
	if err != nil {
		return nil, fmt.Errorf("report not found")
	}
	rows, err := s.DB.Query(ctx, `
		SELECT c.id, c.kind, c.content, COALESCE(u.name, u.email, ''), c."createdAt", c."parentId"
		FROM "SalesReportComment" c
		JOIN "User" u ON u.id=c."authorId"
		WHERE c."reportId"=$1
		ORDER BY c."createdAt" ASC
	`, reportID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var c ReportComment
			if rows.Scan(&c.ID, &c.Kind, &c.Content, &c.AuthorName, &c.CreatedAt, &c.ParentID) == nil {
				d.Comments = append(d.Comments, c)
			}
		}
	}
	return &d, nil
}

func (s *Store) AddReportAnswer(ctx context.Context, orgID, userID, reportID, parentID, content string) error {
	content = strings.TrimSpace(content)
	if content == "" {
		return fmt.Errorf("answer required")
	}
	var owner string
	err := s.DB.QueryRow(ctx, `
		SELECT "submittedById" FROM "SalesReport" WHERE id=$1 AND "orgId"=$2
	`, reportID, orgID).Scan(&owner)
	if err != nil {
		return fmt.Errorf("report not found")
	}
	if owner != userID {
		return fmt.Errorf("only the report author can answer")
	}
	_, err = s.DB.Exec(ctx, `
		INSERT INTO "SalesReportComment" (id, "reportId", "authorId", kind, "parentId", content, "createdAt")
		VALUES ($1,$2,$3,'response',NULLIF($4,''),$5,NOW())
	`, newID(), reportID, userID, parentID, content)
	return err
}
