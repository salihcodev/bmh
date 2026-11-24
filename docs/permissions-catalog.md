---
tags: [be-my-hand, docs, v5, rbac]
status: implemented
updated: 2026-11-19
---

# Permission catalog (v5)

Implemented in V2. The source of truth is `src/services/permissions/catalog.ts` (129 keys: 92 system, 37 workspace, 3 of them baseline). `pnpm data -- --seed` writes it to `permissions` / `permissionGroups` / `permissionPresets` / `systemRoles` and prunes keys that were removed; `pnpm data -- --verify` checks the copy against the file. Some groups are `mixed` scope (system and workspace keys side by side, e.g. chat). Seeded system roles: `owner` (locked; the `owner` userType bypasses the role doc), `support` (`users.view`, `workspaces.view`, `logs.view`, no chat), `moderator`. The tables below are the reviewed draft; where they differ, the code wins.

Source: [[../../refactor_prompt|refactor prompt]] sections 1, 3 and 4. Decisions D-01 to D-04 in [[../APP_PROGRESS#Decisions (2026-11-19)]].

## Model in one page

- **Permission**: one atomic capability, key `<entity>.<action>` in lowercase with hyphens inside a part (`bags.regenerate-link`). Stored at `permissions/{key}` with `group`, `scope`, `label.ar/en`, `description.ar/en`, `order`.
- **Scope**: `system` keys are held by system roles (dashboard staff). `workspace` keys are held by workspace roles and only mean something inside one workspace. A key has exactly one scope.
- **Role**: a list of keys. System roles live in `systemRoles/{roleId}`; workspace roles in `workspaces/{wid}/roles/{roleId}`. Roles store `permissions: string[]` (a list, so dotted keys never become Firestore field paths).
- **Preset**: a named bundle of keys (`permissionPresets/{id}`, with `scope`) that the role editor can add in one tap. Presets are copied into a role when picked; editing a preset later does not change existing roles.
- **Built-ins that bypass the lookup**:
  - `userType == 'owner'` holds every `system` key. The `systemRoles/owner` doc exists for display only and is locked.
  - The workspace member with `roleId == 'admin'` holds every `workspace` key of that workspace. The `roles/admin` doc is created with the workspace, locked, and cannot be removed from the creator.
- **Baseline**: things every active platform user (`member`, `supplier`) can do on **their own** data without any role, for example create a workspace, build a cart, create a bag, review a supplier. Baseline is fixed in code and rules, it is not editable from the dashboard. A system key with the same name extends the action to **any** record (moderation).
- **Delete** exists for every entity. "Delete" is a soft delete (`isDeleted`, `deletedAt`, `deletedBy`) with a confirm dialog and an audit entry, except where the entity is already append-only (history, events, audit logs), which stay undeletable.

## Anti-escalation

Enforced in rules as well as UI:

1. Nobody edits their own role assignment.
2. Assigning a role requires the assigner to hold every key in it: `myRole.permissions.hasAll(targetRole.permissions)`. Owner and workspace admin pass by definition.
3. Editing a role's keys follows the same rule: the new key list must be a subset of the editor's own keys.
4. `userType` `owner` is never granted by a client. It comes only from the seed (Admin SDK).
5. The `admin` workspace role and the `owner` system role are locked: no edit, no delete, no reassignment away from the workspace creator (except the ownership transfer flow that already exists).

## Groups

Ordered as they appear in the role editor.

| Order | Group id | Scope | EN | AR |
| --- | --- | --- | --- | --- |
| 1 | `users` | system | Users and roles | المستخدمون والأدوار |
| 2 | `platform-workspaces` | system | Workspaces (platform) | مساحات العمل (المنصة) |
| 3 | `workspace` | workspace | Workspace and team | مساحة العمل والفريق |
| 4 | `beneficiaries` | workspace | Beneficiaries | المستفيدون |
| 5 | `sessions` | workspace | Distribution sessions | جلسات التوزيع |
| 6 | `store` | system | Store | المتجر |
| 7 | `suppliers` | system | Suppliers | الموردون |
| 8 | `bags` | system | Bags | الحقائب |
| 9 | `reviews` | system | Reviews | التقييمات |
| 10 | `chat` | workspace + system | Chat | المحادثات |
| 11 | `content` | system | Content | المحتوى |
| 12 | `media` | system | Media | الوسائط |
| 13 | `reports` | system | Reports, logs and monitoring | التقارير والسجلات والمراقبة |
| 14 | `settings` | system | Settings and system | الإعدادات والنظام |

`chat` is the only group with keys in both scopes (workspace chat keys, plus the system `chat.moderate`). The role editor filters by scope, so each editor only shows its own half.

## Catalog

Column **Defaults**: `S` = seeded Support role, `M` = seeded Moderator role, `Mb` = default workspace `member` role, `base` = baseline for platform users on their own records. Owner (system) and the workspace `admin` hold every key of their scope and are not repeated.

### 1. Users and roles (`users`, system)

| Key | EN label | AR label | EN description | AR description | Defaults |
| --- | --- | --- | --- | --- | --- |
| `users.view` | View users | عرض المستخدمين | See system and platform users and their profiles. | عرض مستخدمي النظام والمنصة وملفاتهم. | S, M |
| `users.create` | Create users | إنشاء مستخدمين | Create system user accounts and give them a role. | إنشاء حسابات لمستخدمي النظام وإسناد دور لهم. | |
| `users.edit` | Edit users | تعديل المستخدمين | Change a user's name, type and profile fields. | تعديل اسم المستخدم ونوعه وبيانات ملفه. | |
| `users.delete` | Delete users | حذف المستخدمين | Soft-delete an account (it can no longer sign in). | حذف الحساب حذفًا مؤقتًا فلا يستطيع تسجيل الدخول. | |
| `users.suspend` | Suspend users | إيقاف المستخدمين | Suspend or reactivate an account. | إيقاف الحساب أو إعادة تفعيله. | M |
| `roles.view` | View roles | عرض الأدوار | See system roles and their permissions. | عرض أدوار النظام وصلاحياتها. | |
| `roles.create` | Create roles | إنشاء الأدوار | Create a system role from permissions and presets. | إنشاء دور نظام من الصلاحيات والحزم الجاهزة. | |
| `roles.edit` | Edit roles | تعديل الأدوار | Change a system role's name or permissions. | تعديل اسم دور النظام أو صلاحياته. | |
| `roles.delete` | Delete roles | حذف الأدوار | Delete a system role that nobody holds. | حذف دور نظام غير مُسند لأحد. | |
| `roles.assign` | Assign roles | إسناد الأدوار | Give a system role to a system user. | إسناد دور نظام لمستخدم نظام. | |
| `permissions.view` | View permissions | عرض الصلاحيات | See the permission catalog. | عرض قائمة الصلاحيات. | |
| `presets.view` | View presets | عرض الحزم الجاهزة | See permission presets. | عرض حزم الصلاحيات الجاهزة. | |
| `presets.create` | Create presets | إنشاء حزم جاهزة | Create a reusable permission bundle. | إنشاء حزمة صلاحيات قابلة لإعادة الاستخدام. | |
| `presets.edit` | Edit presets | تعديل الحزم الجاهزة | Change a preset's name or permissions. | تعديل اسم الحزمة أو صلاحياتها. | |
| `presets.delete` | Delete presets | حذف الحزم الجاهزة | Delete a preset. Roles built from it keep their permissions. | حذف حزمة. الأدوار المبنية عليها تحتفظ بصلاحياتها. | |

### 2. Workspaces, platform view (`platform-workspaces`, system)

| Key | EN label | AR label | EN description | AR description | Defaults |
| --- | --- | --- | --- | --- | --- |
| `workspaces.view` | View workspaces | عرض مساحات العمل | See workspace names, owners, member lists and counters. Never beneficiary records. | عرض أسماء مساحات العمل وملاكها وأعضائها وأعدادها، دون بيانات المستفيدين. | S, M |
| `workspaces.edit` | Edit workspaces | تعديل مساحات العمل | Rename a workspace or change its description. | تغيير اسم مساحة العمل أو وصفها. | |
| `workspaces.archive` | Archive workspaces | أرشفة مساحات العمل | Archive or restore a workspace (read-only while archived). | أرشفة مساحة العمل أو استعادتها (للقراءة فقط أثناء الأرشفة). | M |
| `workspaces.delete` | Delete workspaces | حذف مساحات العمل | Soft-delete a workspace. | حذف مساحة العمل حذفًا مؤقتًا. | |
| `workspaces.data-view` | View workspace records | عرض سجلات المساحات | Read-only access to beneficiaries, sessions and history in any workspace. Not chat. | اطلاع فقط على المستفيدين والجلسات والسجل في أي مساحة عمل، دون المحادثات. | |

`workspaces.data-view` is the only system key that opens tenant records (Q-01). It is read-only, never includes workspace chat, is not in any seeded role except Owner, and every grant of it writes an admin log entry.

`workspaces.create` is **baseline** (any platform user can create a workspace and becomes its admin), so it is not a role key.

### 3. Workspace and team (`workspace`, workspace)

| Key | EN label | AR label | EN description | AR description | Defaults |
| --- | --- | --- | --- | --- | --- |
| `workspace.edit` | Edit workspace settings | تعديل إعدادات المساحة | Change this workspace's name and description. | تغيير اسم مساحة العمل ووصفها. | |
| `workspace.delete` | Delete workspace | حذف المساحة | Soft-delete this workspace. | حذف مساحة العمل هذه حذفًا مؤقتًا. | |
| `members.view` | View members | عرض الأعضاء | See the team list and each member's role. | عرض قائمة الفريق ودور كل عضو. | Mb |
| `members.invite` | Invite members | دعوة الأعضاء | Create, share and revoke invite links. | إنشاء روابط الدعوة ومشاركتها وإلغاؤها. | |
| `members.edit-role` | Change member roles | تغيير أدوار الأعضاء | Give a member a different workspace role. | إسناد دور آخر لعضو في المساحة. | |
| `members.disable` | Disable members | تعطيل الأعضاء | Disable or re-enable a member's access. | تعطيل وصول العضو أو إعادته. | |
| `members.remove` | Remove members | إزالة الأعضاء | Remove a member from the workspace. | إزالة عضو من مساحة العمل. | |
| `workspace-roles.view` | View workspace roles | عرض أدوار المساحة | See the roles defined in this workspace. | عرض الأدوار المعرّفة في هذه المساحة. | |
| `workspace-roles.create` | Create workspace roles | إنشاء أدوار المساحة | Create a custom role for this workspace. | إنشاء دور مخصص لهذه المساحة. | |
| `workspace-roles.edit` | Edit workspace roles | تعديل أدوار المساحة | Change a custom role's name or permissions. | تعديل اسم الدور المخصص أو صلاحياته. | |
| `workspace-roles.delete` | Delete workspace roles | حذف أدوار المساحة | Delete a custom role that nobody holds. | حذف دور مخصص غير مُسند لأحد. | |
| `audit.view` | View workspace audit log | عرض سجل المساحة | See membership, import and export events. | عرض أحداث العضوية والاستيراد والتصدير. | |

### 4. Beneficiaries (`beneficiaries`, workspace)

| Key | EN label | AR label | EN description | AR description | Defaults |
| --- | --- | --- | --- | --- | --- |
| `beneficiaries.view` | View beneficiaries | عرض المستفيدين | See beneficiary lists, profiles, phones and pins. | عرض قوائم المستفيدين وملفاتهم وأرقامهم ومواقعهم. | Mb |
| `beneficiaries.create` | Add beneficiaries | إضافة مستفيدين | Add a beneficiary. | إضافة مستفيد. | |
| `beneficiaries.edit` | Edit beneficiaries | تعديل المستفيدين | Edit a beneficiary's profile, phones and pins. | تعديل بيانات المستفيد وأرقامه ومواقعه. | |
| `beneficiaries.delete` | Delete beneficiaries | حذف المستفيدين | Archive a beneficiary or restore it. | أرشفة المستفيد أو استعادته. | |
| `beneficiaries.import` | Import beneficiaries | استيراد المستفيدين | Import from Excel or CSV. | الاستيراد من ملف Excel أو CSV. | |
| `beneficiaries.export` | Export beneficiaries | تصدير المستفيدين | Export lists and profiles to xlsx, CSV or PDF. | تصدير القوائم والملفات إلى xlsx أو CSV أو PDF. | |
| `beneficiaries.assign-bag` | Attach bags | ربط الحقائب | Attach a bag to beneficiaries or a session. | ربط حقيبة بمستفيدين أو بجلسة. | |
| `areas.create` | Add cities and areas | إضافة المدن والمناطق | Add a city or an area. | إضافة مدينة أو منطقة. | |
| `areas.edit` | Edit cities and areas | تعديل المدن والمناطق | Rename, deactivate or recount cities and areas. | إعادة تسمية المدن والمناطق أو تعطيلها أو إعادة عدّها. | |
| `areas.delete` | Delete cities and areas | حذف المدن والمناطق | Archive a city or an area. | أرشفة مدينة أو منطقة. | |
| `assistance.record` | Record assistance | تسجيل المساعدات | Add and confirm assistance records. | إضافة سجلات المساعدة وتأكيدها. | |
| `history.view` | View history | عرض السجل | See a beneficiary's change history and recent activity. | عرض سجل تغييرات المستفيد والنشاط الأخير. | Mb |

### 5. Distribution sessions (`sessions`, workspace)

The operator of a session can always see it, operate it and end it; these keys extend that to other people's sessions.

| Key | EN label | AR label | EN description | AR description | Defaults |
| --- | --- | --- | --- | --- | --- |
| `sessions.view` | View all sessions | عرض كل الجلسات | See every session and its report, not only your own. | عرض كل الجلسات وتقاريرها وليس جلساتك فقط. | Mb |
| `sessions.create` | Create sessions | إنشاء الجلسات | Prepare a session (city, areas, beneficiaries). | تجهيز جلسة (المدينة والمناطق والمستفيدون). | |
| `sessions.start` | Start sessions | بدء الجلسات | Take the snapshot and start a session. | أخذ اللقطة وبدء الجلسة. | |
| `sessions.edit` | Edit sessions | تعديل الجلسات | Rename an active session or edit its notes. | إعادة تسمية جلسة نشطة أو تعديل ملاحظاتها. | |
| `sessions.operate` | Operate any session | تشغيل أي جلسة | Check, ignore and reopen items in any active session. | تأكيد العناصر أو تجاهلها أو إعادة فتحها في أي جلسة نشطة. | |
| `sessions.reassign` | Reassign operator | تغيير المشغّل | Hand an active session to another member. | تسليم جلسة نشطة لعضو آخر. | |
| `sessions.end` | End any session | إنهاء أي جلسة | End a session you do not operate. | إنهاء جلسة لست مشغّلها. | |
| `sessions.delete` | Delete sessions | حذف الجلسات | Hide an ended session from lists. Its report and events stay. | إخفاء جلسة منتهية من القوائم مع بقاء تقريرها وأحداثها. | |
| `sessions.export` | Export session reports | تصدير تقارير الجلسات | Export a session report. | تصدير تقرير الجلسة. | |

### 6. Store (`store`, system)

Browsing the store is baseline. Suppliers manage **their own** items as baseline once approved; these keys manage **all** items and the taxonomy.

| Key | EN label | AR label | EN description | AR description | Defaults |
| --- | --- | --- | --- | --- | --- |
| `store-categories.create` | Add categories | إضافة الفئات | Add a category or sub-category. | إضافة فئة أو فئة فرعية. | M |
| `store-categories.edit` | Edit categories | تعديل الفئات | Rename, reorder or deactivate categories. | إعادة تسمية الفئات أو ترتيبها أو تعطيلها. | M |
| `store-categories.delete` | Delete categories | حذف الفئات | Delete a category with no items. | حذف فئة لا تحتوي على منتجات. | M |
| `store-items.view` | View all items | عرض كل المنتجات | See every item including hidden and draft ones. | عرض كل المنتجات بما فيها المخفية والمسودات. | M |
| `store-items.create` | Add items for suppliers | إضافة منتجات للموردين | Add an item on behalf of any supplier. | إضافة منتج نيابة عن أي مورد. | |
| `store-items.edit` | Edit any item | تعديل أي منتج | Edit or hide any supplier's item. | تعديل منتج أي مورد أو إخفاؤه. | M |
| `store-items.delete` | Delete any item | حذف أي منتج | Delete any supplier's item. | حذف منتج أي مورد. | M |

### 7. Suppliers (`suppliers`, system)

| Key | EN label | AR label | EN description | AR description | Defaults |
| --- | --- | --- | --- | --- | --- |
| `suppliers.view` | View all suppliers | عرض كل الموردين | See every supplier including pending and hidden ones. | عرض كل الموردين بمن فيهم المعلّقون والمخفيون. | M |
| `suppliers.approve` | Approve supplier requests | قبول طلبات الموردين | Approve or reject a user's request to become a supplier. | قبول طلب المستخدم ليصبح موردًا أو رفضه. | M |
| `suppliers.verify` | Verify suppliers | توثيق الموردين | Give or remove the verified badge. | منح شارة التوثيق أو سحبها. | M |
| `suppliers.edit` | Edit any supplier | تعديل أي مورد | Edit any supplier profile. | تعديل ملف أي مورد. | M |
| `suppliers.delete` | Delete suppliers | حذف الموردين | Soft-delete a supplier profile and hide its items. | حذف ملف المورد حذفًا مؤقتًا وإخفاء منتجاته. | |

### 8. Bags (`bags`, system)

Creators control their own bags as baseline (edit, delete, share, regenerate link, revert, access mode). Link holders edit collaborative bags as baseline. These keys act on **any** bag.

| Key | EN label | AR label | EN description | AR description | Defaults |
| --- | --- | --- | --- | --- | --- |
| `bags.view` | View all bags | عرض كل الحقائب | Open any bag without its link. | فتح أي حقيبة دون رابطها. | M |
| `bags.edit` | Edit any bag | تعديل أي حقيبة | Edit any bag's items, note and visibility. | تعديل منتجات أي حقيبة وملاحظتها وظهورها. | |
| `bags.delete` | Delete any bag | حذف أي حقيبة | Delete any bag. | حذف أي حقيبة. | M |
| `bags.share` | Share any bag | مشاركة أي حقيبة | Share any bag's link. | مشاركة رابط أي حقيبة. | |
| `bags.regenerate-link` | Regenerate any link | تجديد رابط أي حقيبة | Issue a new link for any bag and disable the old one. | إصدار رابط جديد لأي حقيبة وتعطيل القديم. | M |
| `bags.revert-changes` | Revert changes on any bag | التراجع عن تعديلات أي حقيبة | Revert a change or restore a version on any bag. | التراجع عن تعديل أو استعادة نسخة في أي حقيبة. | M |
| `bags.set-access-mode` | Set access mode on any bag | ضبط وضع الوصول لأي حقيبة | Switch any bag between view-only and collaborative. | تبديل أي حقيبة بين العرض فقط والتعاون. | M |

### 9. Reviews (`reviews`, system)

| Key | EN label | AR label | EN description | AR description | Defaults |
| --- | --- | --- | --- | --- | --- |
| `reviews.create` | Write reviews | كتابة التقييمات | Rate and review a supplier (never yourself). | تقييم مورد ومراجعته (وليس نفسك). | base |
| `reviews.edit-own` | Edit own reviews | تعديل تقييماتي | Edit a review you wrote. | تعديل تقييم كتبته. | base |
| `reviews.delete` | Delete own reviews | حذف تقييماتي | Delete a review you wrote. | حذف تقييم كتبته. | base |
| `reviews.moderate` | Moderate reviews | إدارة التقييمات | Hide or remove anyone's review. | إخفاء أي تقييم أو حذفه. | M |

The three baseline keys are in the catalog so they show up in the role editor as read-only rows and so a suspended state can be explained, but rules grant them from `userType`, not from roles.

### 10. Chat (`chat`)

| Key | Scope | EN label | AR label | EN description | AR description | Defaults |
| --- | --- | --- | --- | --- | --- | --- |
| `chat.view` | workspace | View chat | عرض المحادثة | Read this workspace's chat. | قراءة محادثة مساحة العمل. | Mb |
| `chat.send` | workspace | Send messages | إرسال الرسائل | Send messages and attachments. | إرسال الرسائل والمرفقات. | Mb |
| `chat.delete-own` | workspace | Delete own messages | حذف رسائلي | Edit or delete messages you sent. | تعديل رسائلك أو حذفها. | Mb |
| `chat.delete-any` | workspace | Delete any message | حذف أي رسالة | Delete anyone's message in this workspace. | حذف رسالة أي عضو في هذه المساحة. | |
| `chat.moderate` | system | Moderate chat | إدارة المحادثات | Review reported messages and remove them in any chat. | مراجعة الرسائل المُبلّغ عنها وحذفها في أي محادثة. | M |

Supplier 1:1 chat is baseline for its two participants. Support has no chat key (prompt section 18.1).

### 11. Content (`content`, system)

Every family has the same five actions. `view` lets the dashboard see drafts and inactive items; published content is readable by all signed-in users without any key.

| Family | Entity (EN / AR) | Keys | Defaults |
| --- | --- | --- | --- |
| `banners` | Banners / البانرات | `.view` `.create` `.edit` `.delete` `.publish` | M |
| `news` | News / الأخبار | same five | M |
| `messages` | System messages (empty states, toasts, notices) / رسائل النظام | same five | M |
| `alerts` | Alerts / التنبيهات | same five | M |
| `info-texts` | Info texts (explanations such as the sync queue) / النصوص التوضيحية | same five | M |
| `support-methods` | Support methods / طرق الدعم | same five | M |
| `pages` | Pages (About, Help, legal) / الصفحات | same five | M |

Label pattern for each family, filled in per entity by the seed:

| Action | EN label | AR label | EN description | AR description |
| --- | --- | --- | --- | --- |
| `view` | View {entity} | عرض {entity} | See all {entity}, including drafts. | عرض كل {entity} بما فيها المسودات. |
| `create` | Add {entity} | إضافة {entity} | Create a new item. | إنشاء عنصر جديد. |
| `edit` | Edit {entity} | تعديل {entity} | Change text, image and order. | تعديل النص والصورة والترتيب. |
| `delete` | Delete {entity} | حذف {entity} | Delete an item. | حذف عنصر. |
| `publish` | Publish {entity} | نشر {entity} | Publish, unpublish or schedule. | النشر أو إلغاء النشر أو الجدولة. |

`messages`, `alerts` and `info-texts` are three permission families over the one `systemMessages` collection (CONT-01). Each doc has a `category` field (`message | alert | info-text`) and the rules pick the family from it, so a category can never be changed by someone who lacks the target family's `edit` key (Q-02).

### 12. Media (`media`, system)

Uploading your own avatar, chat attachments, bag covers and supplier images is baseline (each goes through its own preset and creates a `media` doc owned by the uploader).

| Key | EN label | AR label | EN description | AR description | Defaults |
| --- | --- | --- | --- | --- | --- |
| `media.view` | View media library | عرض مكتبة الوسائط | See every uploaded file and the orphan list. | عرض كل الملفات المرفوعة وقائمة الملفات اليتيمة. | M |
| `media.upload` | Upload to library | الرفع إلى المكتبة | Upload banners, support images and other shared media. | رفع البانرات وصور الدعم والوسائط المشتركة. | M |
| `media.delete` | Delete media | حذف الوسائط | Remove a file from use and log it for cleanup. | إزالة ملف من الاستخدام وتسجيله للتنظيف. | M |

### 13. Reports, logs and monitoring (`reports`, system)

| Key | EN label | AR label | EN description | AR description | Defaults |
| --- | --- | --- | --- | --- | --- |
| `logs.view` | View admin log | عرض سجل الإدارة | See the admin log. | عرض سجل الإدارة. | S, M |
| `logs.export` | Export admin log | تصدير سجل الإدارة | Export admin log entries. | تصدير سجلات الإدارة. | |
| `reports.view` | View reports | عرض التقارير | See platform reports. | عرض تقارير المنصة. | M |
| `reports.export` | Export reports | تصدير التقارير | Export platform reports. | تصدير تقارير المنصة. | |
| `monitoring.view` | View monitoring | عرض المراقبة | See usage charts and app health. | عرض رسوم الاستخدام وحالة التطبيق. | M |
| `sync-queue.view` | View sync health | عرض حالة المزامنة | See queue sizes and failures across devices. | عرض أحجام قوائم المزامنة وإخفاقاتها على الأجهزة. | M |
| `sync-queue.manage` | Manage sync health | إدارة حالة المزامنة | Clear stale device summaries. | مسح ملخصات الأجهزة القديمة. | |

### 14. Settings and system (`settings`, system)

| Key | EN label | AR label | EN description | AR description | Defaults |
| --- | --- | --- | --- | --- | --- |
| `app-settings.manage` | Manage app settings | إدارة إعدادات التطبيق | Change app-wide settings. | تغيير إعدادات التطبيق العامة. | |
| `email-templates.manage` | Manage email templates | إدارة قوالب البريد | View email templates and their variables. | عرض قوالب البريد ومتغيراتها. | |
| `home-config.manage` | Manage Home screen | إدارة الشاشة الرئيسية | Choose Home sections, their order and counts. | اختيار أقسام الشاشة الرئيسية وترتيبها وأعدادها. | M |

## Totals

| Scope | Keys |
| --- | --- |
| system | 92 (users 15, workspaces 5, store 7, suppliers 5, bags 7, reviews 4, chat 1, content 35, media 3, reports 7, settings 3) |
| workspace | 37 (workspace 12, beneficiaries 12, sessions 9, chat 4) |
| total | 129 |

A role doc with 129 keys is about 3 KB; well under the 1 MB doc limit, and rules list `in` / `hasAll` checks are cheap.

## Seeded roles

### System roles (`systemRoles/{id}`)

| Id | EN / AR | Keys | Locked |
| --- | --- | --- | --- |
| `owner` | Owner / المالك | all system keys (implicit via `userType`) | yes |
| `support` | Support / الدعم | `users.view`, `workspaces.view`, `logs.view` | no |
| `moderator` | Moderator / المشرف | every key marked `M` above | no |

Support follows prompt 18.1 exactly: read-only users and workspaces, logs, no chat. It does **not** include `monitoring.view` or `sync-queue.view`; add them if support staff should see health charts (Q-03).

### Workspace roles (`workspaces/{wid}/roles/{id}`, written in the workspace creation batch)

| Id | EN / AR | Keys | Locked |
| --- | --- | --- | --- |
| `admin` | Admin / المدير | all workspace keys (implicit) | yes |
| `member` | Member / عضو | every key marked `Mb` above | no (editable, not deletable while it is the invite default) |

### Presets (`permissionPresets/{id}`)

| Id | Scope | EN / AR | Keys |
| --- | --- | --- | --- |
| `read-only-staff` | system | Read-only staff / موظف للاطلاع فقط | `users.view`, `workspaces.view`, `logs.view` |
| `content-editor` | system | Content editor / محرر المحتوى | all `content` keys, `media.view`, `media.upload`, `home-config.manage` |
| `store-moderator` | system | Store moderator / مشرف المتجر | all `store` and `suppliers` keys except `suppliers.delete`, plus `reviews.moderate`, `bags.view`, `bags.delete` |
| `community-moderator` | system | Community moderator / مشرف المجتمع | `chat.moderate`, `reviews.moderate`, `users.view`, `users.suspend` |
| `field-operator` | workspace | Field operator / مشغّل ميداني | `beneficiaries.view`, `sessions.view`, `sessions.create`, `sessions.start`, `history.view`, `chat.view`, `chat.send`, `chat.delete-own` |
| `data-entry` | workspace | Data entry / إدخال البيانات | `beneficiaries.view`, `beneficiaries.create`, `beneficiaries.edit`, `beneficiaries.import`, `areas.create`, `areas.edit`, `history.view` |
| `coordinator` | workspace | Coordinator / منسّق | everything in `field-operator` and `data-entry`, plus `sessions.operate`, `sessions.reassign`, `sessions.end`, `sessions.export`, `beneficiaries.export`, `assistance.record`, `members.view`, `members.invite` |
| `viewer` | workspace | Viewer / مُطّلع | `beneficiaries.view`, `sessions.view`, `history.view`, `members.view`, `chat.view` |

## Baseline grants (not role keys)

| Who | Can do on their own records |
| --- | --- |
| Any active platform user (`member`, `supplier`) | Create a workspace (becomes `admin`), join by invite, browse store and public suppliers, cart, create and manage own bags, edit collaborative bags they hold a link to, review suppliers (not self), supplier 1:1 chat, upload own avatar / chat / bag images, request supplier status |
| Approved `supplier` | Edit own supplier profile, CRUD own store items, reply in own supplier chats |
| System users (`support`, `moderator`, custom) | Nothing beyond their system role. They do not see the app tabs (DASH-02) |
| `owner` | Every system key, and the normal app as a platform user |

## Old to new key map

For the V2 refactor of `src/services/permissions/matrix.ts`, `can.ts`, `platform.ts`, `firestore.rules` and the tests. Data is wiped (D-03), so this map is for code only, not a data migration.

| Old (`matrix.ts` / `platform.ts`) | New |
| --- | --- |
| `beneficiaries_view` | `beneficiaries.view` |
| `beneficiaries_create` | `beneficiaries.create` |
| `beneficiaries_edit` | `beneficiaries.edit` |
| `beneficiaries_archive` | `beneficiaries.delete` (soft delete = archive) |
| `beneficiaries_import` | `beneficiaries.import` |
| `beneficiaries_export` | `beneficiaries.export` |
| `areas_manage` | `areas.create`, `areas.edit`, `areas.delete` |
| `members_manage` | `members.invite`, `members.edit-role`, `members.disable`, `members.remove`, `audit.view` |
| `sessions_create` | `sessions.create`, `sessions.start` |
| `sessions_run` | `sessions.operate` |
| `sessions_reassign` | `sessions.reassign` |
| `sessions_view_history` | `sessions.view` |
| `assistance_record` | `assistance.record` |
| `history_view` | `history.view` |
| role `owner` (workspace) | role `admin` (built-in, creator) |
| role `admin` (workspace) | the built-in `admin` role given to more members (Q-04), or a custom role built from the `coordinator` preset |
| role `member` (workspace) | role `member` |
| `platform_manage_users` | `users.*`, `roles.*` |
| `platform_manage_content` | `banners.*`, `news.*`, `messages.*`, `alerts.*`, `info-texts.*`, `support-methods.*`, `pages.*`, `home-config.manage` |
| `platform_manage_media` | `media.*` |
| `platform_view_reports` | `reports.view`, `logs.view`, `monitoring.view` |
| `globalRole: superadmin` / `isSuperAdmin()` | `userType: owner` |

## Review answers (2026-11-19)

- **Q-01 Tenant data in the dashboard: a permission.** `workspaces.data-view` gives read-only access to beneficiaries, sessions and history in any workspace (not chat). Owner holds it implicitly; no other seeded role has it. `tests/rules/admin.test.ts` changes from "super admin never reads tenant data" to "only `workspaces.data-view` reads tenant data, and never writes it".
- **Q-02 Three content families.** `messages.*`, `alerts.*` and `info-texts.*` are separate, gated by the `category` field of `systemMessages`.
- **Q-03 Support stays minimal.** Users, workspaces and logs read-only; no monitoring or sync health.
- **Q-04 Several admins per workspace.** The creator's `admin` assignment is locked; the creator (or any admin) can give `admin` to other members.
