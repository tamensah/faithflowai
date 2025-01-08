# FaithFlow Database Schema

## Overview

The FaithFlow platform uses PostgreSQL with Prisma as the ORM. The schema is designed to support multi-tenancy with complete data isolation between churches.

## Core Models

### Church
```prisma
model Church {
	id          String   @id @default(cuid())
	createdAt   DateTime @default(now())
	updatedAt   DateTime @updatedAt
	name        String
	slug        String   @unique
	domain      String?  @unique
	timezone    String   @default("UTC")
	
	// Subscription
	plan        String   @default("starter")
	planStatus  String   @default("active")
	features    String[]
	
	// Branding
	logo        String?
	colors      Json?    // Primary, secondary, accent colors
	
	// Relations
	members     Member[]
	events      Event[]
	giving      Giving[]
	groups      Group[]
	
	@@index([slug])
	@@index([domain])
}
```

### Member
```prisma
model Member {
	id          String   @id @default(cuid())
	churchId    String
	createdAt   DateTime @default(now())
	updatedAt   DateTime @updatedAt
	
	// Personal Info
	firstName   String
	lastName    String
	email       String?
	phone       String?
	address     Json?    // Structured address data
	
	// Church Info
	status      String   @default("active")
	joinDate    DateTime @default(now())
	memberType  String   @default("individual")
	
	// Family
	familyId    String?
	familyRole  String?
	
	// Relations
	church      Church    @relation(fields: [churchId], references: [id])
	family      Family?   @relation(fields: [familyId], references: [id])
	attendance  Attendance[]
	giving      Giving[]
	groups      GroupMember[]
	
	@@index([churchId])
	@@index([email])
	@@index([familyId])
}
```

### Family
```prisma
model Family {
	id          String   @id @default(cuid())
	churchId    String
	name        String
	address     Json?
	
	// Relations
	church      Church   @relation(fields: [churchId], references: [id])
	members     Member[]
	
	@@index([churchId])
}
```

### Event
```prisma
model Event {
	id          String   @id @default(cuid())
	churchId    String
	createdAt   DateTime @default(now())
	updatedAt   DateTime @updatedAt
	
	// Event Details
	title       String
	description String?
	startDate   DateTime
	endDate     DateTime
	type        String   // service, meeting, class
	location    Json?    // Physical or virtual location
	
	// Registration
	capacity    Int?
	registration Boolean @default(false)
	
	// Relations
	church      Church      @relation(fields: [churchId], references: [id])
	attendance  Attendance[]
	resources   Resource[]
	
	@@index([churchId])
	@@index([startDate])
}
```

### Giving
```prisma
model Giving {
	id          String   @id @default(cuid())
	churchId    String
	memberId    String?
	createdAt   DateTime @default(now())
	
	// Transaction
	amount      Decimal
	currency    String
	method      String   // card, bank, mobile_money
	status      String   // completed, pending, failed
	
	// Details
	type        String   // one_time, recurring
	campaign    String?
	frequency   String?  // weekly, monthly, quarterly
	nextDate    DateTime?
	
	// Relations
	church      Church   @relation(fields: [churchId], references: [id])
	member      Member?  @relation(fields: [memberId], references: [id])
	
	@@index([churchId])
	@@index([memberId])
	@@index([createdAt])
}
```

### Group
```prisma
model Group {
	id          String   @id @default(cuid())
	churchId    String
	name        String
	type        String   // ministry, small_group, committee
	description String?
	
	// Relations
	church      Church        @relation(fields: [churchId], references: [id])
	members     GroupMember[]
	
	@@index([churchId])
}
```

### GroupMember
```prisma
model GroupMember {
	id          String   @id @default(cuid())
	groupId     String
	memberId    String
	role        String   // leader, member
	joinDate    DateTime @default(now())
	
	// Relations
	group       Group    @relation(fields: [groupId], references: [id])
	member      Member   @relation(fields: [memberId], references: [id])
	
	@@unique([groupId, memberId])
	@@index([groupId])
	@@index([memberId])
}
```

### Attendance
```prisma
model Attendance {
	id          String   @id @default(cuid())
	eventId     String
	memberId    String
	checkIn     DateTime @default(now())
	checkOut    DateTime?
	
	// Relations
	event       Event    @relation(fields: [eventId], references: [id])
	member      Member   @relation(fields: [memberId], references: [id])
	
	@@index([eventId])
	@@index([memberId])
}
```

### Resource
```prisma
model Resource {
	id          String   @id @default(cuid())
	churchId    String
	eventId     String?
	name        String
	type        String   // room, equipment, vehicle
	status      String   // available, in_use, maintenance
	
	// Relations
	church      Church   @relation(fields: [churchId], references: [id])
	event       Event?   @relation(fields: [eventId], references: [id])
	
	@@index([churchId])
	@@index([eventId])
}
```

## Indexes and Performance

### Key Indexes
- Church: slug, domain
- Member: churchId, email, familyId
- Event: churchId, startDate
- Giving: churchId, memberId, createdAt
- Group: churchId
- Attendance: eventId, memberId

### Query Optimization
- Composite indexes for common queries
- Partial indexes for filtered queries
- Expression indexes for computed values

## Data Migration

### Version Control
```sql
-- Example migration
CREATE MIGRATION "add_member_status"
BEGIN
	ALTER TABLE "Member" ADD COLUMN "status" text NOT NULL DEFAULT 'active';
	CREATE INDEX "member_status_idx" ON "Member"("status");
END;
```

### Backup Strategy
- Daily full backups
- Continuous WAL archiving
- Point-in-time recovery
- Cross-region replication

## Security Measures

### Data Protection
- Row-level security
- Column encryption
- Audit logging
- Access controls

### Compliance
- GDPR requirements
- Data retention policies
- Privacy controls
- Audit trails