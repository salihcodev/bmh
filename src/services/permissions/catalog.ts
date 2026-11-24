// Permission catalog (docs/permissions-catalog.md). Single source of truth for keys, groups,
// labels, seeded roles and presets. The seed script imports this file directly with Node, so it
// must stay free of imports and non-erasable TypeScript (no enums, no path aliases).

export type PermissionScope = 'system' | 'workspace';
export type Bilingual = { ar: string; en: string };

/** `S` Support, `M` Moderator, `Mb` workspace member, `base` baseline for platform users. */
type DefaultMark = 'S' | 'M' | 'Mb' | 'base';

type Row = readonly [key: string, en: string, ar: string, enDescription: string, arDescription: string, marks?: string];

export const PERMISSION_GROUPS = [
  { id: 'users', scope: 'system', order: 1, name: { en: 'Users and roles', ar: 'المستخدمون والأدوار' } },
  { id: 'platform-workspaces', scope: 'system', order: 2, name: { en: 'Workspaces (platform)', ar: 'مساحات العمل (المنصة)' } },
  { id: 'workspace', scope: 'workspace', order: 3, name: { en: 'Workspace and team', ar: 'مساحة العمل والفريق' } },
  { id: 'beneficiaries', scope: 'workspace', order: 4, name: { en: 'Beneficiaries', ar: 'المستفيدون' } },
  { id: 'sessions', scope: 'workspace', order: 5, name: { en: 'Distribution sessions', ar: 'جلسات التوزيع' } },
  { id: 'store', scope: 'system', order: 6, name: { en: 'Store', ar: 'المتجر' } },
  { id: 'suppliers', scope: 'system', order: 7, name: { en: 'Suppliers', ar: 'الموردون' } },
  { id: 'bags', scope: 'system', order: 8, name: { en: 'Bags', ar: 'الحقائب' } },
  { id: 'reviews', scope: 'system', order: 9, name: { en: 'Reviews', ar: 'التقييمات' } },
  { id: 'chat', scope: 'mixed', order: 10, name: { en: 'Chat', ar: 'المحادثات' } },
  { id: 'content', scope: 'system', order: 11, name: { en: 'Content', ar: 'المحتوى' } },
  { id: 'media', scope: 'system', order: 12, name: { en: 'Media', ar: 'الوسائط' } },
  { id: 'reports', scope: 'system', order: 13, name: { en: 'Reports, logs and monitoring', ar: 'التقارير والسجلات والمراقبة' } },
  { id: 'settings', scope: 'system', order: 14, name: { en: 'Settings and system', ar: 'الإعدادات والنظام' } },
] as const;

export type PermissionGroupId = (typeof PERMISSION_GROUPS)[number]['id'];

const WORKSPACE_ROWS = {
  workspace: [
    ['workspace.edit', 'Edit workspace settings', 'تعديل إعدادات المساحة', "Change this workspace's name and description.", 'تغيير اسم مساحة العمل ووصفها.'],
    ['workspace.delete', 'Delete workspace', 'حذف المساحة', 'Soft-delete this workspace.', 'حذف مساحة العمل هذه حذفًا مؤقتًا.'],
    ['members.view', 'View members', 'عرض الأعضاء', "See the team list and each member's role.", 'عرض قائمة الفريق ودور كل عضو.', 'Mb'],
    ['members.invite', 'Invite members', 'دعوة الأعضاء', 'Create, share and revoke invite links.', 'إنشاء روابط الدعوة ومشاركتها وإلغاؤها.'],
    ['members.edit-role', 'Change member roles', 'تغيير أدوار الأعضاء', 'Give a member a different workspace role.', 'إسناد دور آخر لعضو في المساحة.'],
    ['members.disable', 'Disable members', 'تعطيل الأعضاء', "Disable or re-enable a member's access.", 'تعطيل وصول العضو أو إعادته.'],
    ['members.remove', 'Remove members', 'إزالة الأعضاء', 'Remove a member from the workspace.', 'إزالة عضو من مساحة العمل.'],
    ['workspace-roles.view', 'View workspace roles', 'عرض أدوار المساحة', 'See the roles defined in this workspace.', 'عرض الأدوار المعرّفة في هذه المساحة.'],
    ['workspace-roles.create', 'Create workspace roles', 'إنشاء أدوار المساحة', 'Create a custom role for this workspace.', 'إنشاء دور مخصص لهذه المساحة.'],
    ['workspace-roles.edit', 'Edit workspace roles', 'تعديل أدوار المساحة', "Change a custom role's name or permissions.", 'تعديل اسم الدور المخصص أو صلاحياته.'],
    ['workspace-roles.delete', 'Delete workspace roles', 'حذف أدوار المساحة', 'Delete a custom role that nobody holds.', 'حذف دور مخصص غير مُسند لأحد.'],
    ['audit.view', 'View workspace audit log', 'عرض سجل المساحة', 'See membership, import and export events.', 'عرض أحداث العضوية والاستيراد والتصدير.'],
  ],
  beneficiaries: [
    ['beneficiaries.view', 'View beneficiaries', 'عرض المستفيدين', 'See beneficiary lists, profiles, phones and pins.', 'عرض قوائم المستفيدين وملفاتهم وأرقامهم ومواقعهم.', 'Mb'],
    ['beneficiaries.create', 'Add beneficiaries', 'إضافة مستفيدين', 'Add a beneficiary.', 'إضافة مستفيد.'],
    ['beneficiaries.edit', 'Edit beneficiaries', 'تعديل المستفيدين', "Edit a beneficiary's profile, phones and pins.", 'تعديل بيانات المستفيد وأرقامه ومواقعه.'],
    ['beneficiaries.delete', 'Delete beneficiaries', 'حذف المستفيدين', 'Archive a beneficiary or restore it.', 'أرشفة المستفيد أو استعادته.'],
    ['beneficiaries.import', 'Import beneficiaries', 'استيراد المستفيدين', 'Import from Excel or CSV.', 'الاستيراد من ملف Excel أو CSV.'],
    ['beneficiaries.export', 'Export beneficiaries', 'تصدير المستفيدين', 'Export lists and profiles to xlsx, CSV or PDF.', 'تصدير القوائم والملفات إلى xlsx أو CSV أو PDF.'],
    ['beneficiaries.assign-bag', 'Attach bags', 'ربط الحقائب', 'Attach a bag to beneficiaries or a session.', 'ربط حقيبة بمستفيدين أو بجلسة.'],
    ['areas.create', 'Add cities and areas', 'إضافة المدن والمناطق', 'Add a city or an area.', 'إضافة مدينة أو منطقة.'],
    ['areas.edit', 'Edit cities and areas', 'تعديل المدن والمناطق', 'Rename, deactivate or recount cities and areas.', 'إعادة تسمية المدن والمناطق أو تعطيلها أو إعادة عدّها.'],
    ['areas.delete', 'Delete cities and areas', 'حذف المدن والمناطق', 'Archive a city or an area.', 'أرشفة مدينة أو منطقة.'],
    ['assistance.record', 'Record assistance', 'تسجيل المساعدات', 'Add and confirm assistance records.', 'إضافة سجلات المساعدة وتأكيدها.'],
    ['history.view', 'View history', 'عرض السجل', "See a beneficiary's change history and recent activity.", 'عرض سجل تغييرات المستفيد والنشاط الأخير.', 'Mb'],
  ],
  sessions: [
    ['sessions.view', 'View all sessions', 'عرض كل الجلسات', 'See every session and its report, not only your own.', 'عرض كل الجلسات وتقاريرها وليس جلساتك فقط.', 'Mb'],
    ['sessions.create', 'Create sessions', 'إنشاء الجلسات', 'Prepare a session (city, areas, beneficiaries).', 'تجهيز جلسة (المدينة والمناطق والمستفيدون).'],
    ['sessions.start', 'Start sessions', 'بدء الجلسات', 'Take the snapshot and start a session.', 'أخذ اللقطة وبدء الجلسة.'],
    ['sessions.edit', 'Edit sessions', 'تعديل الجلسات', 'Rename an active session or edit its notes.', 'إعادة تسمية جلسة نشطة أو تعديل ملاحظاتها.'],
    ['sessions.operate', 'Operate any session', 'تشغيل أي جلسة', 'Check, ignore and reopen items in any active session.', 'تأكيد العناصر أو تجاهلها أو إعادة فتحها في أي جلسة نشطة.'],
    ['sessions.reassign', 'Reassign operator', 'تغيير المشغّل', 'Hand an active session to another member.', 'تسليم جلسة نشطة لعضو آخر.'],
    ['sessions.end', 'End any session', 'إنهاء أي جلسة', 'End a session you do not operate.', 'إنهاء جلسة لست مشغّلها.'],
    ['sessions.delete', 'Delete sessions', 'حذف الجلسات', 'Hide an ended session from lists. Its report and events stay.', 'إخفاء جلسة منتهية من القوائم مع بقاء تقريرها وأحداثها.'],
    ['sessions.export', 'Export session reports', 'تصدير تقارير الجلسات', 'Export a session report.', 'تصدير تقرير الجلسة.'],
  ],
  chat: [
    ['chat.view', 'View chat', 'عرض المحادثة', "Read this workspace's chat.", 'قراءة محادثة مساحة العمل.', 'Mb'],
    ['chat.send', 'Send messages', 'إرسال الرسائل', 'Send messages and attachments.', 'إرسال الرسائل والمرفقات.', 'Mb'],
    ['chat.delete-own', 'Delete own messages', 'حذف رسائلي', 'Edit or delete messages you sent.', 'تعديل رسائلك أو حذفها.', 'Mb'],
    ['chat.delete-any', 'Delete any message', 'حذف أي رسالة', "Delete anyone's message in this workspace.", 'حذف رسالة أي عضو في هذه المساحة.'],
  ],
} as const satisfies Partial<Record<PermissionGroupId, readonly Row[]>>;

const SYSTEM_ROWS = {
  users: [
    ['users.view', 'View users', 'عرض المستخدمين', 'See system and platform users and their profiles.', 'عرض مستخدمي النظام والمنصة وملفاتهم.', 'S M'],
    ['users.create', 'Create users', 'إنشاء مستخدمين', 'Create system user accounts and give them a role.', 'إنشاء حسابات لمستخدمي النظام وإسناد دور لهم.'],
    ['users.edit', 'Edit users', 'تعديل المستخدمين', "Change a user's name, type and profile fields.", 'تعديل اسم المستخدم ونوعه وبيانات ملفه.'],
    ['users.delete', 'Delete users', 'حذف المستخدمين', 'Soft-delete an account (it can no longer sign in).', 'حذف الحساب حذفًا مؤقتًا فلا يستطيع تسجيل الدخول.'],
    ['users.suspend', 'Suspend users', 'إيقاف المستخدمين', 'Suspend or reactivate an account.', 'إيقاف الحساب أو إعادة تفعيله.', 'M'],
    ['roles.view', 'View roles', 'عرض الأدوار', 'See system roles and their permissions.', 'عرض أدوار النظام وصلاحياتها.'],
    ['roles.create', 'Create roles', 'إنشاء الأدوار', 'Create a system role from permissions and presets.', 'إنشاء دور نظام من الصلاحيات والحزم الجاهزة.'],
    ['roles.edit', 'Edit roles', 'تعديل الأدوار', "Change a system role's name or permissions.", 'تعديل اسم دور النظام أو صلاحياته.'],
    ['roles.delete', 'Delete roles', 'حذف الأدوار', 'Delete a system role that nobody holds.', 'حذف دور نظام غير مُسند لأحد.'],
    ['roles.assign', 'Assign roles', 'إسناد الأدوار', 'Give a system role to a system user.', 'إسناد دور نظام لمستخدم نظام.'],
    ['permissions.view', 'View permissions', 'عرض الصلاحيات', 'See the permission catalog.', 'عرض قائمة الصلاحيات.'],
    ['presets.view', 'View presets', 'عرض الحزم الجاهزة', 'See permission presets.', 'عرض حزم الصلاحيات الجاهزة.'],
    ['presets.create', 'Create presets', 'إنشاء حزم جاهزة', 'Create a reusable permission bundle.', 'إنشاء حزمة صلاحيات قابلة لإعادة الاستخدام.'],
    ['presets.edit', 'Edit presets', 'تعديل الحزم الجاهزة', "Change a preset's name or permissions.", 'تعديل اسم الحزمة أو صلاحياتها.'],
    ['presets.delete', 'Delete presets', 'حذف الحزم الجاهزة', 'Delete a preset. Roles built from it keep their permissions.', 'حذف حزمة. الأدوار المبنية عليها تحتفظ بصلاحياتها.'],
  ],
  'platform-workspaces': [
    ['workspaces.view', 'View workspaces', 'عرض مساحات العمل', 'See workspace names, owners, member lists and counters. Never beneficiary records.', 'عرض أسماء مساحات العمل وملاكها وأعضائها وأعدادها، دون بيانات المستفيدين.', 'S M'],
    ['workspaces.edit', 'Edit workspaces', 'تعديل مساحات العمل', 'Rename a workspace or change its description.', 'تغيير اسم مساحة العمل أو وصفها.'],
    ['workspaces.archive', 'Archive workspaces', 'أرشفة مساحات العمل', 'Archive or restore a workspace (read-only while archived).', 'أرشفة مساحة العمل أو استعادتها (للقراءة فقط أثناء الأرشفة).', 'M'],
    ['workspaces.delete', 'Delete workspaces', 'حذف مساحات العمل', 'Soft-delete a workspace.', 'حذف مساحة العمل حذفًا مؤقتًا.'],
    ['workspaces.data-view', 'View workspace records', 'عرض سجلات المساحات', 'Read-only access to beneficiaries, sessions and history in any workspace. Not chat.', 'اطلاع فقط على المستفيدين والجلسات والسجل في أي مساحة عمل، دون المحادثات.'],
  ],
  store: [
    ['store-categories.create', 'Add categories', 'إضافة الفئات', 'Add a category or sub-category.', 'إضافة فئة أو فئة فرعية.', 'M'],
    ['store-categories.edit', 'Edit categories', 'تعديل الفئات', 'Rename, reorder or deactivate categories.', 'إعادة تسمية الفئات أو ترتيبها أو تعطيلها.', 'M'],
    ['store-categories.delete', 'Delete categories', 'حذف الفئات', 'Delete a category with no items.', 'حذف فئة لا تحتوي على منتجات.', 'M'],
    ['store-items.view', 'View all items', 'عرض كل المنتجات', 'See every item including hidden and draft ones.', 'عرض كل المنتجات بما فيها المخفية والمسودات.', 'M'],
    ['store-items.create', 'Add items for suppliers', 'إضافة منتجات للموردين', 'Add an item on behalf of any supplier.', 'إضافة منتج نيابة عن أي مورد.'],
    ['store-items.edit', 'Edit any item', 'تعديل أي منتج', "Edit or hide any supplier's item.", 'تعديل منتج أي مورد أو إخفاؤه.', 'M'],
    ['store-items.delete', 'Delete any item', 'حذف أي منتج', "Delete any supplier's item.", 'حذف منتج أي مورد.', 'M'],
  ],
  suppliers: [
    ['suppliers.view', 'View all suppliers', 'عرض كل الموردين', 'See every supplier including pending and hidden ones.', 'عرض كل الموردين بمن فيهم المعلّقون والمخفيون.', 'M'],
    ['suppliers.approve', 'Approve supplier requests', 'قبول طلبات الموردين', "Approve or reject a user's request to become a supplier.", 'قبول طلب المستخدم ليصبح موردًا أو رفضه.', 'M'],
    ['suppliers.verify', 'Verify suppliers', 'توثيق الموردين', 'Give or remove the verified badge.', 'منح شارة التوثيق أو سحبها.', 'M'],
    ['suppliers.edit', 'Edit any supplier', 'تعديل أي مورد', 'Edit any supplier profile.', 'تعديل ملف أي مورد.', 'M'],
    ['suppliers.delete', 'Delete suppliers', 'حذف الموردين', 'Soft-delete a supplier profile and hide its items.', 'حذف ملف المورد حذفًا مؤقتًا وإخفاء منتجاته.'],
  ],
  bags: [
    ['bags.view', 'View all bags', 'عرض كل الحقائب', 'Open any bag without its link.', 'فتح أي حقيبة دون رابطها.', 'M'],
    ['bags.edit', 'Edit any bag', 'تعديل أي حقيبة', "Edit any bag's items, note and visibility.", 'تعديل منتجات أي حقيبة وملاحظتها وظهورها.'],
    ['bags.delete', 'Delete any bag', 'حذف أي حقيبة', 'Delete any bag.', 'حذف أي حقيبة.', 'M'],
    ['bags.share', 'Share any bag', 'مشاركة أي حقيبة', "Share any bag's link.", 'مشاركة رابط أي حقيبة.'],
    ['bags.regenerate-link', 'Regenerate any link', 'تجديد رابط أي حقيبة', 'Issue a new link for any bag and disable the old one.', 'إصدار رابط جديد لأي حقيبة وتعطيل القديم.', 'M'],
    ['bags.revert-changes', 'Revert changes on any bag', 'التراجع عن تعديلات أي حقيبة', 'Revert a change or restore a version on any bag.', 'التراجع عن تعديل أو استعادة نسخة في أي حقيبة.', 'M'],
    ['bags.set-access-mode', 'Set access mode on any bag', 'ضبط وضع الوصول لأي حقيبة', 'Switch any bag between view-only and collaborative.', 'تبديل أي حقيبة بين العرض فقط والتعاون.', 'M'],
  ],
  reviews: [
    ['reviews.create', 'Write reviews', 'كتابة التقييمات', 'Rate and review a supplier (never yourself).', 'تقييم مورد ومراجعته (وليس نفسك).', 'base'],
    ['reviews.edit-own', 'Edit own reviews', 'تعديل تقييماتي', 'Edit a review you wrote.', 'تعديل تقييم كتبته.', 'base'],
    ['reviews.delete', 'Delete own reviews', 'حذف تقييماتي', 'Delete a review you wrote.', 'حذف تقييم كتبته.', 'base'],
    ['reviews.moderate', 'Moderate reviews', 'إدارة التقييمات', "Hide or remove anyone's review.", 'إخفاء أي تقييم أو حذفه.', 'M'],
  ],
  chat: [
    ['chat.moderate', 'Moderate chat', 'إدارة المحادثات', 'Review reported messages and remove them in any chat.', 'مراجعة الرسائل المُبلّغ عنها وحذفها في أي محادثة.', 'M'],
  ],
  media: [
    ['media.view', 'View media library', 'عرض مكتبة الوسائط', 'See every uploaded file and the orphan list.', 'عرض كل الملفات المرفوعة وقائمة الملفات اليتيمة.', 'M'],
    ['media.upload', 'Upload to library', 'الرفع إلى المكتبة', 'Upload banners, support images and other shared media.', 'رفع البانرات وصور الدعم والوسائط المشتركة.', 'M'],
    ['media.delete', 'Delete media', 'حذف الوسائط', 'Remove a file from use and log it for cleanup.', 'إزالة ملف من الاستخدام وتسجيله للتنظيف.', 'M'],
  ],
  reports: [
    ['logs.view', 'View admin log', 'عرض سجل الإدارة', 'See the admin log.', 'عرض سجل الإدارة.', 'S M'],
    ['logs.export', 'Export admin log', 'تصدير سجل الإدارة', 'Export admin log entries.', 'تصدير سجلات الإدارة.'],
    ['reports.view', 'View reports', 'عرض التقارير', 'See platform reports.', 'عرض تقارير المنصة.', 'M'],
    ['reports.export', 'Export reports', 'تصدير التقارير', 'Export platform reports.', 'تصدير تقارير المنصة.'],
    ['monitoring.view', 'View monitoring', 'عرض المراقبة', 'See usage charts and app health.', 'عرض رسوم الاستخدام وحالة التطبيق.', 'M'],
    ['sync-queue.view', 'View sync health', 'عرض حالة المزامنة', 'See queue sizes and failures across devices.', 'عرض أحجام قوائم المزامنة وإخفاقاتها على الأجهزة.', 'M'],
    ['sync-queue.manage', 'Manage sync health', 'إدارة حالة المزامنة', 'Clear stale device summaries.', 'مسح ملخصات الأجهزة القديمة.'],
  ],
  settings: [
    ['app-settings.manage', 'Manage app settings', 'إدارة إعدادات التطبيق', 'Change app-wide settings.', 'تغيير إعدادات التطبيق العامة.'],
    ['email-templates.manage', 'Manage email templates', 'إدارة قوالب البريد', 'View email templates and their variables.', 'عرض قوالب البريد ومتغيراتها.'],
    ['home-config.manage', 'Manage Home screen', 'إدارة الشاشة الرئيسية', 'Choose Home sections, their order and counts.', 'اختيار أقسام الشاشة الرئيسية وترتيبها وأعدادها.', 'M'],
  ],
} as const satisfies Partial<Record<PermissionGroupId, readonly Row[]>>;

const CONTENT_FAMILIES = {
  banners: { en: 'banners', ar: 'البانرات' },
  news: { en: 'news', ar: 'الأخبار' },
  messages: { en: 'system messages', ar: 'رسائل النظام' },
  alerts: { en: 'alerts', ar: 'التنبيهات' },
  'info-texts': { en: 'info texts', ar: 'النصوص التوضيحية' },
  'support-methods': { en: 'support methods', ar: 'طرق الدعم' },
  pages: { en: 'pages', ar: 'الصفحات' },
} as const;

const CONTENT_ACTIONS = {
  view: { en: 'View', ar: 'عرض', enDescription: 'See all {entity}, including drafts.', arDescription: 'عرض كل {entity} بما فيها المسودات.' },
  create: { en: 'Add', ar: 'إضافة', enDescription: 'Create a new item.', arDescription: 'إنشاء عنصر جديد.' },
  edit: { en: 'Edit', ar: 'تعديل', enDescription: 'Change text, image and order.', arDescription: 'تعديل النص والصورة والترتيب.' },
  delete: { en: 'Delete', ar: 'حذف', enDescription: 'Delete an item.', arDescription: 'حذف عنصر.' },
  publish: { en: 'Publish', ar: 'نشر', enDescription: 'Publish, unpublish or schedule.', arDescription: 'النشر أو إلغاء النشر أو الجدولة.' },
} as const;

export type ContentFamily = keyof typeof CONTENT_FAMILIES;
type ContentAction = keyof typeof CONTENT_ACTIONS;
type ContentKey = `${ContentFamily}.${ContentAction}`;

type RowsKey<T extends Record<string, readonly Row[]>> = T[keyof T][number][0];

export type WorkspacePermission = RowsKey<typeof WORKSPACE_ROWS>;
export type SystemPermission = RowsKey<typeof SYSTEM_ROWS> | ContentKey;
export type PermissionKey = WorkspacePermission | SystemPermission;

export type PermissionDef = {
  key: PermissionKey;
  group: PermissionGroupId;
  scope: PermissionScope;
  order: number;
  label: Bilingual;
  description: Bilingual;
  /** Granted from userType in rules, not from roles. Shown read-only in role editors. */
  baseline: boolean;
};

const marks = new Map<string, DefaultMark[]>();

function fromRows(rows: Record<string, readonly Row[]>, scope: PermissionScope): PermissionDef[] {
  const defs: PermissionDef[] = [];
  for (const [group, list] of Object.entries(rows)) {
    for (const [key, en, ar, enDescription, arDescription, mark] of list) {
      const keyMarks = (mark ?? '').split(' ').filter(Boolean) as DefaultMark[];
      marks.set(key, keyMarks);
      defs.push({
        key: key as PermissionKey,
        group: group as PermissionGroupId,
        scope,
        order: 0,
        label: { en, ar },
        description: { en: enDescription, ar: arDescription },
        baseline: keyMarks.includes('base'),
      });
    }
  }
  return defs;
}

function contentDefs(): PermissionDef[] {
  const defs: PermissionDef[] = [];
  for (const [family, entity] of Object.entries(CONTENT_FAMILIES)) {
    for (const [action, text] of Object.entries(CONTENT_ACTIONS)) {
      const key = `${family}.${action}`;
      marks.set(key, ['M']);
      defs.push({
        key: key as PermissionKey,
        group: 'content',
        scope: 'system',
        order: 0,
        label: { en: `${text.en} ${entity.en}`, ar: `${text.ar} ${entity.ar}` },
        description: {
          en: text.enDescription.replace('{entity}', entity.en),
          ar: text.arDescription.replace('{entity}', entity.ar),
        },
        baseline: false,
      });
    }
  }
  return defs;
}

const groupOrder = new Map<string, number>(PERMISSION_GROUPS.map((g) => [g.id, g.order]));

export const PERMISSION_CATALOG: readonly PermissionDef[] = [
  ...fromRows(WORKSPACE_ROWS, 'workspace'),
  ...fromRows(SYSTEM_ROWS, 'system'),
  ...contentDefs(),
]
  .sort((a, b) => (groupOrder.get(a.group) ?? 0) - (groupOrder.get(b.group) ?? 0))
  .map((def, index) => ({ ...def, order: index + 1 }));

export const PERMISSION_KEYS: readonly PermissionKey[] = PERMISSION_CATALOG.map((d) => d.key);

export const WORKSPACE_PERMISSIONS = PERMISSION_CATALOG.filter((d) => d.scope === 'workspace').map(
  (d) => d.key,
) as readonly WorkspacePermission[];

export const SYSTEM_PERMISSIONS = PERMISSION_CATALOG.filter((d) => d.scope === 'system').map(
  (d) => d.key,
) as readonly SystemPermission[];

const byKey = new Map<string, PermissionDef>(PERMISSION_CATALOG.map((d) => [d.key, d]));

export function permissionDef(key: string): PermissionDef | undefined {
  return byKey.get(key);
}

export function isPermissionKey(key: string): key is PermissionKey {
  return byKey.has(key);
}

/** Keeps only known keys of one scope, deduplicated, in catalog order. */
export function sanitizeKeys<S extends PermissionScope>(
  keys: readonly unknown[] | undefined,
  scope: S,
): (S extends 'workspace' ? WorkspacePermission : SystemPermission)[] {
  const wanted = new Set(keys?.filter((k): k is string => typeof k === 'string'));
  return PERMISSION_CATALOG.filter((d) => d.scope === scope && !d.baseline && wanted.has(d.key)).map(
    (d) => d.key,
  ) as (S extends 'workspace' ? WorkspacePermission : SystemPermission)[];
}

/** Keys a role can hold (baseline keys are granted from userType instead). */
export function assignableKeys<S extends PermissionScope>(
  scope: S,
): (S extends 'workspace' ? WorkspacePermission : SystemPermission)[] {
  return PERMISSION_CATALOG.filter((d) => d.scope === scope && !d.baseline).map((d) => d.key) as (S extends 'workspace'
    ? WorkspacePermission
    : SystemPermission)[];
}

function keysWith(mark: DefaultMark, scope: PermissionScope): PermissionKey[] {
  return PERMISSION_CATALOG.filter((d) => d.scope === scope && (marks.get(d.key) ?? []).includes(mark)).map(
    (d) => d.key,
  );
}

/** Built-in workspace role ids. `admin` holds every workspace key and cannot be edited or deleted. */
export const WORKSPACE_ADMIN_ROLE = 'admin';
export const WORKSPACE_MEMBER_ROLE = 'member';

export type RoleSeed = {
  id: string;
  name: Bilingual;
  permissions: PermissionKey[];
  isLocked: boolean;
};

export const SYSTEM_ROLE_SEEDS: readonly RoleSeed[] = [
  { id: 'owner', name: { en: 'Owner', ar: 'المالك' }, permissions: assignableKeys('system'), isLocked: true },
  { id: 'support', name: { en: 'Support', ar: 'الدعم' }, permissions: keysWith('S', 'system'), isLocked: false },
  { id: 'moderator', name: { en: 'Moderator', ar: 'المشرف' }, permissions: keysWith('M', 'system'), isLocked: false },
];

export const WORKSPACE_ROLE_SEEDS: readonly RoleSeed[] = [
  {
    id: WORKSPACE_ADMIN_ROLE,
    name: { en: 'Admin', ar: 'المدير' },
    permissions: assignableKeys('workspace'),
    isLocked: true,
  },
  {
    id: WORKSPACE_MEMBER_ROLE,
    name: { en: 'Member', ar: 'عضو' },
    permissions: keysWith('Mb', 'workspace'),
    isLocked: false,
  },
];

export type PresetSeed = { id: string; scope: PermissionScope; name: Bilingual; permissions: PermissionKey[] };

const contentKeys = PERMISSION_CATALOG.filter((d) => d.group === 'content').map((d) => d.key);
const groupKeys = (group: PermissionGroupId) => PERMISSION_CATALOG.filter((d) => d.group === group).map((d) => d.key);

const fieldOperator: WorkspacePermission[] = [
  'beneficiaries.view', 'sessions.view', 'sessions.create', 'sessions.start', 'history.view',
  'chat.view', 'chat.send', 'chat.delete-own',
];
const dataEntry: WorkspacePermission[] = [
  'beneficiaries.view', 'beneficiaries.create', 'beneficiaries.edit', 'beneficiaries.import',
  'areas.create', 'areas.edit', 'history.view',
];

export const PRESET_SEEDS: readonly PresetSeed[] = [
  {
    id: 'read-only-staff',
    scope: 'system',
    name: { en: 'Read-only staff', ar: 'موظف للاطلاع فقط' },
    permissions: ['users.view', 'workspaces.view', 'logs.view'],
  },
  {
    id: 'content-editor',
    scope: 'system',
    name: { en: 'Content editor', ar: 'محرر المحتوى' },
    permissions: [...contentKeys, 'media.view', 'media.upload', 'home-config.manage'],
  },
  {
    id: 'store-moderator',
    scope: 'system',
    name: { en: 'Store moderator', ar: 'مشرف المتجر' },
    permissions: [
      ...groupKeys('store'),
      ...groupKeys('suppliers').filter((k) => k !== 'suppliers.delete'),
      'reviews.moderate', 'bags.view', 'bags.delete',
    ],
  },
  {
    id: 'community-moderator',
    scope: 'system',
    name: { en: 'Community moderator', ar: 'مشرف المجتمع' },
    permissions: ['chat.moderate', 'reviews.moderate', 'users.view', 'users.suspend'],
  },
  { id: 'field-operator', scope: 'workspace', name: { en: 'Field operator', ar: 'مشغّل ميداني' }, permissions: fieldOperator },
  { id: 'data-entry', scope: 'workspace', name: { en: 'Data entry', ar: 'إدخال البيانات' }, permissions: dataEntry },
  {
    id: 'coordinator',
    scope: 'workspace',
    name: { en: 'Coordinator', ar: 'منسّق' },
    permissions: [
      ...new Set<WorkspacePermission>([
        ...fieldOperator, ...dataEntry,
        'sessions.operate', 'sessions.reassign', 'sessions.end', 'sessions.export',
        'beneficiaries.export', 'assistance.record', 'members.view', 'members.invite',
      ]),
    ],
  },
  {
    id: 'viewer',
    scope: 'workspace',
    name: { en: 'Viewer', ar: 'مُطّلع' },
    permissions: ['beneficiaries.view', 'sessions.view', 'history.view', 'members.view', 'chat.view'],
  },
];
