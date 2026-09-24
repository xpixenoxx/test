
export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'HR' | 'EMPLOYEE' | 'TEAM_LEAD' | 'MANAGEMENT';
export type WorkType = 'OFFICE' | 'FIELD';
export type SubscriptionStatus = 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'SUSPENDED' | 'AD_SUPPORTED';

export type UpgradeRequestType = 'DONATION' | 'TRIAL_EXTENSION' | 'AD_SUPPORTED';
export type UpgradeRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type DonationTier = 'TIER_3MO' | 'TIER_6MO' | 'TIER_1YR' | 'TIER_LIFETIME';

export interface SocialLink {
  id: string;
  platform: string;
  url: string;
  displayOrder: number;
  isActive: boolean;
  created?: string;
}

export interface ShowcaseOrganization {
  id: string;
  name: string;
  logo: string;
  country?: string;
  industry?: string;
  websiteUrl?: string;
  tagline?: string;
  displayOrder: number;
  isActive: boolean;
  created?: string;
}

export interface AppTheme {
  id: string;
  name: string;
  colors: {
    primary: string;
    hover: string;
    light: string;
  };
}

export interface Organization {
  id: string;
  name: string;
  address?: string;
  logo?: string;
  country?: string;
  subscriptionStatus?: SubscriptionStatus;
  trialEndDate?: string;
  created?: string;
  updated?: string;
  /**
   * Showcase consent (Addendum 4 §5b). True only if an ADMIN of this organization has
   * explicitly agreed to show its name and logo on the public landing page. Defaults to
   * false for every organization and is withdrawable from Organization & Setup → System.
   * `landingConsentAt` is retained after withdrawal as an audit record.
   */
  showOnLanding?: boolean;
  landingConsentAt?: string;
  // Computed fields
  userCount?: number;
  adminEmail?: string;
  adminVerified?: boolean;
}

export interface SubscriptionInfo {
  status: SubscriptionStatus;
  trialEndDate?: string;
  daysRemaining?: number;
  isSuperAdmin: boolean;
  isReadOnly: boolean;  // true for EXPIRED
  isBlocked: boolean;   // true for SUSPENDED
  showAds: boolean;     // true for AD_SUPPORTED
  isDemo: boolean;      // true for demo organization
}

export interface UpgradeRequest {
  id: string;
  organizationId: string;
  organizationName?: string;
  requestType: UpgradeRequestType;
  status: UpgradeRequestStatus;
  // Donation fields
  donationAmount?: number;
  donationTier?: DonationTier;
  donationReference?: string;
  donationScreenshot?: string;
  // Extension fields
  extensionReason?: string;
  extensionDays?: number;
  // Processing fields
  adminNotes?: string;
  processedBy?: string;
  processedAt?: string;
  created?: string;
}

export interface PlatformStats {
  totalOrganizations: number;
  totalUsers: number;
  activeOrganizations: number;
  trialOrganizations: number;
  expiredOrganizations: number;
  recentRegistrations: number;
}

export interface Team {
  id: string;
  name: string;
  leaderId: string;
  department?: string;
  organizationId?: string;
}

export interface User {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  role: Role;
  department: string;
  designation: string;
  avatar?: string;
  username?: string;
  teamId?: string;
  shiftId?: string;
  organizationId?: string;
  verified?: boolean;
}

export interface Employee extends User {
  joiningDate: string;
  mobile: string;
  emergencyContact: string;
  salary: number;
  status: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
  employmentType: 'PERMANENT' | 'CONTRACT' | 'TEMPORARY';
  location: string;
  nid?: string;
  password?: string;
  lineManagerId?: string;
  workType: WorkType;
}

export interface Attendance {
  id: string;
  employeeId: string;
  employeeName?: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE' | 'EARLY_OUT' | 'HALF_DAY';
  location?: { lat: number; lng: number; address?: string };
  remarks?: string;
  selfie?: string;
  dutyType?: 'WFH' | 'OFFICE';
  organizationId?: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  lineManagerId?: string;
  type: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: 'PENDING_MANAGER' | 'PENDING_HR' | 'APPROVED' | 'REJECTED';
  appliedDate: string;
  approverRemarks?: string;
  managerRemarks?: string;
  organizationId?: string;
}

export interface LeaveBalance {
  employeeId: string;
  [key: string]: string | number;
}

export interface LeavePolicy {
  defaults: Record<string, number>;
  overrides: Record<string, Record<string, number>>;
}

export interface LeaveWorkflow {
  department: string;
  approverRole: 'LINE_MANAGER' | 'HR' | 'ADMIN';
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
  isGovernment: boolean;
  type: 'FESTIVAL' | 'ISLAMIC' | 'NATIONAL';
}

export interface SentEmail {
  id: string;
  to: string;
  subject: string;
  body: string;
  sentAt: string;
  status: 'SENT' | 'FAILED' | 'QUEUED';
  provider: string;
}

export interface RelayConfig {
  username: string;
  fromName: string;
  isActive: boolean;
  relayUrl: string;
  resendApiKey?: string;
  useDirectResend?: boolean;
}

export interface OfficeLocation {
  name: string;
  lat: number;
  lng: number;
  radius: number;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  coverImage: string;
  status: 'DRAFT' | 'PUBLISHED';
  authorId: string;
  authorName: string;
  category: string;
  publishedAt: string;
  created: string;
  updated: string;
  readingTime: number;
}

export interface Tutorial {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  coverImage: string;
  status: 'DRAFT' | 'PUBLISHED';
  authorName: string;
  displayOrder: number;
  parentId: string;
  category: string;
  publishedAt: string;
  created: string;
  updated: string;
}

export interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  lateGracePeriod: number;
  earlyOutGracePeriod: number;
  earliestCheckIn: string;
  autoSessionCloseTime: string;
  workingDays: string[];
  isDefault: boolean;
}

export interface ShiftOverride {
  id: string;
  employeeId: string;
  shiftId: string;
  startDate: string;
  endDate: string;
  reason: string;
}

export interface AppConfig {
  companyName: string;
  timezone: string;
  currency: string;
  dateFormat: string;
  workingDays: string[];
  officeStartTime: string;
  officeEndTime: string;
  lateGracePeriod: number;
  earlyOutGracePeriod: number;
  earliestCheckIn?: string; // HH:mm - Earliest allowed punch-in
  autoSessionCloseTime?: string; // HH:mm - Auto check-out time
  defaultReportRecipient?: string;
  smtp?: RelayConfig;
  overtimeEnabled?: boolean;
  autoAbsentEnabled?: boolean;
  autoAbsentTime?: string; // HH:mm
  officeLocations?: OfficeLocation[];
  dutyLabel1?: string; // Display label for OFFICE duty type (default "Office")
  dutyLabel2?: string; // Display label for FACTORY duty type (default "Factory")
}

export interface RegistrationData {
  orgName: string;
  adminName: string;
  email: string;
  password: string;
  country: string;
  address?: string;
  logo?: File | null;
}

// Announcement Types
export type AnnouncementPriority = 'NORMAL' | 'URGENT';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  priority: AnnouncementPriority;
  targetRoles: Role[];
  expiresAt?: string;
  organizationId: string;
  created: string;
  updated: string;
}

// Notification Types
export type NotificationType = 'ANNOUNCEMENT' | 'LEAVE' | 'ATTENDANCE' | 'REVIEW' | 'SYSTEM' | 'NEW_REGISTRATION' | 'UPGRADE_REQUEST';
export type NotificationPriority = 'NORMAL' | 'URGENT';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  isRead: boolean;
  priority: NotificationPriority;
  referenceId?: string;
  referenceType?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
  organizationId: string;
  created: string;
  updated: string;
}

// Notification Config Types
export type EmailDigestFrequency = 'IMMEDIATE' | 'DAILY' | 'WEEKLY' | 'OFF';

export interface OrgNotificationConfig {
  enabledTypes: NotificationType[];
  emailDigestFrequency: EmailDigestFrequency;
  quietHoursEnabled: boolean;
  quietHoursStart: string;   // HH:mm
  quietHoursEnd: string;     // HH:mm
}

export interface UserNotificationPreferences {
  mutedTypes: NotificationType[];
  emailDigestFrequency: EmailDigestFrequency;
}

// Performance Review Types
export type ReviewCycleType = 'MID_YEAR' | 'YEAR_END';
export type ReviewCycleStatus = 'UPCOMING' | 'OPEN' | 'CLOSED' | 'ARCHIVED';
export type ReviewStatus = 'DRAFT' | 'SELF_REVIEW_SUBMITTED' | 'MANAGER_REVIEWED' | 'COMPLETED';
export type CompetencyId = string;
export type HROverallRating = string;

export interface CustomCompetency {
  id: string;
  name: string;
  description: string;
  behaviors: string[];
}

export interface CustomRatingScale {
  min: number;
  max: number;
  labels: { value: number; label: string; color: string }[];
}

export interface OrgReviewConfig {
  competencies: CustomCompetency[];
  ratingScale: CustomRatingScale;
  overallRatings: { value: string; label: string; color: string }[];
}

export interface CustomLeaveType {
  id: string;
  name: string;
  color: string;
  hasBalance: boolean;
}

export interface ReviewCycle {
  id: string;
  name: string;
  cycleType: ReviewCycleType;
  startDate: string;
  endDate: string;
  reviewStartDate: string;
  reviewEndDate: string;
  activeCompetencies: string[];
  isActive: boolean;
  status: ReviewCycleStatus;
  organizationId: string;
}

export interface CompetencyRating {
  competencyId: string;
  rating: number;
  comment: string;
}

export interface AttendanceSummary {
  totalWorkingDays: number;
  presentDays: number;
  lateDays: number;
  absentDays: number;
  earlyOutDays: number;
  attendancePercentage: number;
}

// Per-employee summary row for the Employee Summary Report
export interface EmployeeAttendanceSummary {
  employeeId: string;
  employeeName: string;
  department: string;
  designation: string;
  totalWorkingDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  leaveDays: number;
  halfDays: number;
  attendancePercentage: number;
}

export interface LeaveSummary {
  typeBreakdown: Record<string, number>;
  totalLeaveDays: number;
  // Legacy fields for backward compat with old reviews
  annualLeaveTaken?: number;
  casualLeaveTaken?: number;
  sickLeaveTaken?: number;
  unpaidLeaveTaken?: number;
}

export interface PerformanceReview {
  id: string;
  employeeId: string;
  employeeName: string;
  cycleId: string;
  lineManagerId?: string;
  managerName?: string;
  status: ReviewStatus;
  submittedAt?: string;
  managerReviewedAt?: string;
  completedAt?: string;
  // Self-assessment ratings
  selfRatings: CompetencyRating[];
  // Manager ratings
  managerRatings: CompetencyRating[];
  // Attendance summary
  attendanceSummary: AttendanceSummary;
  // Leave summary
  leaveSummary: LeaveSummary;
  // HR finalization
  hrFinalRemarks?: string;
  hrOverallRating?: HROverallRating;
  finalizedBy?: string;
  organizationId: string;
}

export interface Client {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  status: 'ACTIVE' | 'INACTIVE';
  organizationId: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  clientId?: string;
  startDate?: string;
  endDate?: string;
  status: 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
  managerId?: string;
  budget?: number;
  organizationId: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  employeeId: string;
  role: string;
  organizationId: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  assignedTo?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: string;
  organizationId: string;
}

export interface Timesheet {
  id: string;
  employeeId: string;
  projectId: string;
  taskId?: string;
  date: string;
  hours: number;
  description?: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  organizationId: string;
}

// ── Payroll ────────────────────────────────────────────────────────────────

export interface SalaryStructure {
  id: string;
  name: string;
  basicPercent: number;
  hraPercent: number;
  daPercent: number;
  specialAllowancePercent: number;
  pfEmployeePercent: number;
  pfEmployerPercent: number;
  esiEmployeePercent: number;
  esiEmployerPercent: number;
  professionalTax: number;
  isDefault: boolean;
  organizationId: string;
}

export interface EmployeeSalary {
  id: string;
  employeeId: string;
  salaryStructureId?: string;
  ctcAnnual: number;
  effectiveFrom: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  panNumber?: string;
  organizationId: string;
}

export interface PayrollRun {
  id: string;
  month: number;
  year: number;
  status: 'DRAFT' | 'PROCESSING' | 'APPROVED' | 'PAID';
  processedBy?: string;
  processedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  notes?: string;
  organizationId: string;
}

export interface Payslip {
  id: string;
  payrollRunId: string;
  employeeId: string;
  employeeName?: string;
  month: number;
  year: number;
  // Earnings
  basic: number;
  hra: number;
  da: number;
  specialAllowance: number;
  overtime: number;
  bonus: number;
  grossEarnings: number;
  // Deductions
  pfEmployee: number;
  esiEmployee: number;
  professionalTax: number;
  tds: number;
  otherDeductions: number;
  loanDeduction: number;
  totalDeductions: number;
  // Net
  netSalary: number;
  // Attendance
  workingDays: number;
  daysPresent: number;
  daysAbsent: number;
  daysLeave: number;
  lopDays: number;
  lopDeduction: number;
  status: 'GENERATED' | 'APPROVED' | 'PAID' | 'HELD';
  remarks?: string;
  organizationId: string;
}

export interface SalaryAdvance {
  id: string;
  employeeId: string;
  amount: number;
  reason?: string;
  monthlyInstallment?: number;
  remainingAmount?: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CLEARED';
  approvedBy?: string;
  appliedDate: string;
  organizationId: string;
}

// ── Expenses ───────────────────────────────────────────────────────────────

export interface Expense {
  id: string;
  organizationId: string;
  employeeId: string;
  category: string;
  amount: number;
  currency: string;
  date: string;
  merchant?: string;
  description?: string;
  receiptUrl?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REIMBURSED';
  approvedBy?: string;
  approvedAt?: string;
  reimbursedAt?: string;
  created?: string;
  updated?: string;
}

// ── Assets ─────────────────────────────────────────────────────────────────

export interface Asset {
  id: string;
  organizationId: string;
  name: string;
  category: string;
  serialNumber?: string;
  status: 'AVAILABLE' | 'ALLOCATED' | 'MAINTENANCE' | 'RETIRED';
  assignedTo?: string;
  assignedAt?: string;
  condition?: string;
  purchaseDate?: string;
  purchaseCost?: number;
  notes?: string;
  created?: string;
  updated?: string;
}

// ── Documents ──────────────────────────────────────────────────────────────

export interface Document {
  id: string;
  organizationId: string;
  name: string;
  category: string;
  fileUrl: string;
  fileType?: string;
  sizeBytes?: number;
  ownerId?: string | null;
  uploadedBy: string;
  created?: string;
  updated?: string;
}

// ── Invoicing ──────────────────────────────────────────────────────────────

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Invoice {
  id: string;
  organizationId: string;
  clientId: string;
  projectId?: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  currency: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string;
  created?: string;
  updated?: string;
  items?: InvoiceItem[];
}
