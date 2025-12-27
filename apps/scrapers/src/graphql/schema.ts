/**
 * GraphQL Schema Definitions
 * Type definitions for the Meridian GraphQL API
 */

export const typeDefs = /* GraphQL */ `
  scalar DateTime
  scalar JSON

  type Query {
    # Articles
    article(id: ID!): Article
    articles(filter: ArticleFilter, pagination: PaginationInput): ArticleConnection!

    # Sources
    source(id: ID!): Source
    sources(filter: SourceFilter, pagination: PaginationInput): SourceConnection!

    # Reports
    report(id: ID, slug: String): Report
    reports(filter: ReportFilter, pagination: PaginationInput): ReportConnection!

    # Search
    search(query: String!, options: SearchOptions): SearchResults!

    # Analytics
    stats: DashboardStats!
    articleTrends(period: TimePeriod!): [TrendPoint!]!
    topSources(limit: Int): [SourceStats!]!

    # User
    me: User
    preferences: UserPreferences
  }

  type Mutation {
    # Sources
    createSource(input: CreateSourceInput!): Source!
    updateSource(id: ID!, input: UpdateSourceInput!): Source!
    deleteSource(id: ID!): DeleteResult!
    triggerScrape(sourceId: ID!): ScrapeJob!

    # Articles
    markArticleRead(articleId: ID!): Article!
    flagArticle(articleId: ID!, reason: String!): Article!

    # Reports
    publishReport(id: ID!): Report!
    scheduleReport(input: ScheduleReportInput!): ScheduledReport!

    # User
    updatePreferences(input: UpdatePreferencesInput!): UserPreferences!
    subscribeToNewsletter(email: String!): NewsletterSubscription!

    # Push Notifications
    registerPushSubscription(input: PushSubscriptionInput!): PushSubscription!

    # Experiments
    trackExperimentEvent(experimentId: ID!, eventName: String!, value: Float): Boolean!
  }

  type Subscription {
    # Real-time updates
    articleAdded(sourceIds: [ID!]): Article!
    reportPublished: Report!
    scrapeProgress(jobId: ID!): ScrapeProgress!
  }

  # Pagination
  input PaginationInput {
    limit: Int = 20
    offset: Int = 0
    cursor: String
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
    totalCount: Int!
  }

  # Article Types
  type Article {
    id: ID!
    title: String!
    url: String!
    content: String
    summary: String
    source: Source!
    publishedAt: DateTime
    scrapedAt: DateTime!
    analyzedAt: DateTime

    # Analysis
    topics: [String!]
    entities: [Entity!]
    sentiment: SentimentScore
    significance: SignificanceLevel

    # Moderation
    flagged: Boolean!
    moderationStatus: ModerationStatus

    # Deduplication
    isDuplicate: Boolean!
    duplicateOf: Article

    # Engagement
    readCount: Int!
    shareCount: Int!
  }

  type ArticleConnection {
    edges: [ArticleEdge!]!
    pageInfo: PageInfo!
  }

  type ArticleEdge {
    node: Article!
    cursor: String!
  }

  input ArticleFilter {
    sourceIds: [ID!]
    topics: [String!]
    regions: [String!]
    dateRange: DateRangeInput
    significance: SignificanceLevel
    excludeFlagged: Boolean
    excludeDuplicates: Boolean
    search: String
  }

  type Entity {
    name: String!
    type: EntityType!
    salience: Float!
  }

  enum EntityType {
    PERSON
    ORGANIZATION
    LOCATION
    EVENT
    PRODUCT
    OTHER
  }

  type SentimentScore {
    score: Float!
    magnitude: Float!
    label: SentimentLabel!
  }

  enum SentimentLabel {
    POSITIVE
    NEGATIVE
    NEUTRAL
    MIXED
  }

  enum SignificanceLevel {
    CRITICAL
    HIGH
    MEDIUM
    LOW
    NOISE
  }

  enum ModerationStatus {
    PENDING
    APPROVED
    REJECTED
    REVIEW
  }

  # Source Types
  type Source {
    id: ID!
    name: String!
    url: String!
    category: String!
    enabled: Boolean!
    scrapeFrequency: Int!

    # Health
    health: SourceHealth!

    # Stats
    articleCount: Int!
    lastScrape: DateTime

    # Config
    firecrawlMode: FirecrawlMode
    customHeaders: JSON
  }

  type SourceConnection {
    edges: [SourceEdge!]!
    pageInfo: PageInfo!
  }

  type SourceEdge {
    node: Source!
    cursor: String!
  }

  input SourceFilter {
    categories: [String!]
    enabled: Boolean
    healthStatus: HealthStatus
    search: String
  }

  type SourceHealth {
    status: HealthStatus!
    successRate: Float!
    totalScrapes: Int!
    successfulScrapes: Int!
    failedScrapes: Int!
    avgResponseTimeMs: Float
    lastSuccess: DateTime
    lastFailure: DateTime
    lastError: String
  }

  enum HealthStatus {
    HEALTHY
    DEGRADED
    FAILING
    UNKNOWN
  }

  enum FirecrawlMode {
    NONE
    SCRAPE
    AGENT
  }

  input CreateSourceInput {
    url: String!
    name: String!
    category: String!
    scrapeFrequency: Int = 2
    enabled: Boolean = true
    firecrawlMode: FirecrawlMode
    customHeaders: JSON
  }

  input UpdateSourceInput {
    name: String
    category: String
    scrapeFrequency: Int
    enabled: Boolean
    firecrawlMode: FirecrawlMode
    customHeaders: JSON
  }

  # Report Types
  type Report {
    id: ID!
    slug: String!
    title: String!
    content: String!
    summary: String
    publishedAt: DateTime!

    # Metadata
    articleCount: Int!
    modelAuthor: String
    clusteringParams: JSON

    # Versions
    version: Int!
    versions: [ReportVersion!]
  }

  type ReportVersion {
    id: ID!
    version: Int!
    content: String!
    createdAt: DateTime!
    diff: String
  }

  type ReportConnection {
    edges: [ReportEdge!]!
    pageInfo: PageInfo!
  }

  type ReportEdge {
    node: Report!
    cursor: String!
  }

  input ReportFilter {
    dateRange: DateRangeInput
    search: String
  }

  type ScheduledReport {
    id: ID!
    cronExpression: String!
    timezone: String!
    enabled: Boolean!
    nextRun: DateTime
    lastRun: DateTime
  }

  input ScheduleReportInput {
    cronExpression: String!
    timezone: String!
    topics: [String!]
    regions: [String!]
    modelPreference: ModelPreference
  }

  enum ModelPreference {
    FAST
    BALANCED
    QUALITY
  }

  # Search Types
  type SearchResults {
    articles: [Article!]!
    totalCount: Int!
    facets: SearchFacets
    took: Int!
  }

  type SearchFacets {
    topics: [FacetCount!]!
    sources: [FacetCount!]!
    dates: [FacetCount!]!
  }

  type FacetCount {
    value: String!
    count: Int!
  }

  input SearchOptions {
    limit: Int = 20
    offset: Int = 0
    sortBy: SearchSortBy = RELEVANCE
    filters: ArticleFilter
  }

  enum SearchSortBy {
    RELEVANCE
    DATE_DESC
    DATE_ASC
    SIGNIFICANCE
  }

  # Analytics Types
  type DashboardStats {
    sources: SourceSummary!
    articles: ArticleSummary!
    reports: ReportSummary!
    processing: ProcessingSummary!
  }

  type SourceSummary {
    total: Int!
    enabled: Int!
    healthy: Int!
    failing: Int!
  }

  type ArticleSummary {
    today: Int!
    thisWeek: Int!
    thisMonth: Int!
    total: Int!
  }

  type ReportSummary {
    published: Int!
    scheduled: Int!
    draft: Int!
  }

  type ProcessingSummary {
    pending: Int!
    inProgress: Int!
    failed: Int!
    avgProcessingTime: Float!
  }

  type TrendPoint {
    date: DateTime!
    count: Int!
    label: String
  }

  type SourceStats {
    source: Source!
    articleCount: Int!
    avgSignificance: Float!
    successRate: Float!
  }

  enum TimePeriod {
    HOUR
    DAY
    WEEK
    MONTH
    YEAR
  }

  # User Types
  type User {
    id: ID!
    email: String!
    tier: UserTier!
    preferences: UserPreferences!
    createdAt: DateTime!
  }

  enum UserTier {
    FREE
    PRO
    ENTERPRISE
    ADMIN
  }

  type UserPreferences {
    topics: [String!]!
    regions: [String!]!
    sources: SourcePreferences!
    notifications: NotificationPreferences!
    display: DisplayPreferences!
  }

  type SourcePreferences {
    included: [ID!]!
    excluded: [ID!]!
  }

  type NotificationPreferences {
    email: Boolean!
    push: Boolean!
    frequency: NotificationFrequency!
  }

  enum NotificationFrequency {
    IMMEDIATE
    DAILY
    WEEKLY
    NEVER
  }

  type DisplayPreferences {
    language: String!
    theme: Theme!
    summaryLength: SummaryLength!
  }

  enum Theme {
    LIGHT
    DARK
    SYSTEM
  }

  enum SummaryLength {
    SHORT
    MEDIUM
    LONG
  }

  input UpdatePreferencesInput {
    topics: [String!]
    regions: [String!]
    includedSources: [ID!]
    excludedSources: [ID!]
    emailNotifications: Boolean
    pushNotifications: Boolean
    notificationFrequency: NotificationFrequency
    language: String
    theme: Theme
    summaryLength: SummaryLength
  }

  # Newsletter
  type NewsletterSubscription {
    id: ID!
    email: String!
    subscribedAt: DateTime!
    confirmed: Boolean!
  }

  # Push Notifications
  type PushSubscription {
    id: ID!
    endpoint: String!
    createdAt: DateTime!
  }

  input PushSubscriptionInput {
    endpoint: String!
    keys: PushKeysInput!
  }

  input PushKeysInput {
    p256dh: String!
    auth: String!
  }

  # Scraping
  type ScrapeJob {
    id: ID!
    sourceId: ID!
    status: ScrapeJobStatus!
    startedAt: DateTime!
    completedAt: DateTime
    articlesFound: Int
    error: String
  }

  enum ScrapeJobStatus {
    PENDING
    RUNNING
    COMPLETED
    FAILED
  }

  type ScrapeProgress {
    jobId: ID!
    status: ScrapeJobStatus!
    progress: Float!
    articlesFound: Int!
    message: String
  }

  # Common Types
  input DateRangeInput {
    start: DateTime!
    end: DateTime!
  }

  type DeleteResult {
    success: Boolean!
    id: ID!
  }
`;

export default typeDefs;
