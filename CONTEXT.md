# VitNode

VitNode is a plugin-based community platform: a core package plus plugins that add pages, API modules, content types and widgets to a host app. This glossary names the concepts shared by the core, plugins and docs.

## Staff and sessions

**Staff**:
A user who holds a root role, or who has an admin or moderator permission entry, directly or through any primary or secondary role. An entry with zero permissions still makes the user staff.
_Avoid_: admin user, privileged user

**Admin**:
Staff of the admin type: the only staff who can open an AdminCP session.
_Avoid_: administrator (that is a seeded role name, not a type)

**Moderator**:
Staff of the moderator type. Moderators act from the public site with their user session and never get an AdminCP session.

**Root role**:
A role flagged root. It grants every staff permission of both types to everyone who holds it, as a primary or a secondary role.
_Avoid_: superadmin, owner

**Primary role / Secondary role**:
A user has exactly one primary role and any number of secondary roles. Every permission decision counts all of them.

**Session kind**:
Either a user session (public site, long-lived cookie) or an AdminCP session (AdminCP, browser-session cookie, sliding idle timeout, admins only). Each kind has its own storage, cookie and cache.

**AdminCP session**:
A session of the admin kind. Signing in to the AdminCP opens one separately from the user session.
_Avoid_: admin session cookie, staff session

**Device**:
A browser identified by its device cookie. A session is valid only on the device it was created on, and revoking a device ends every session of every kind on it.

**Admin module**:
An API module declared as requiring an AdminCP session. Every route under it requires one.
_Avoid_: /admin/ route

## Content Engine

**Content type**:
A plugin-defined kind of entry (for example a blog post), with its fields, localization and editorial settings.

**Editorial content type**:
A content type with drafts, versions and revisions. Shared-field changes require the version the editor started from.

**Shared fields**:
The values of an entry that every language has in common.

**Translation**:
One locale's localized values of an entry, with its own version and publication state.

**Default translation**:
The translation in the content type's default locale. Every localized entry has one.

**Save**:
One transactional write of an entry's shared fields and any number of its translations.

**Content commit**:
The committed outcome of one content write, for a record or a translation.

**Commit effects**:
Everything a content commit triggers once its transaction has ended: events, delivery events, search indexing and revalidation.

**Public reachability**:
Whether a record or one of its locales was, or is, readable through the public API, before or after a commit.

**Revalidation origin**:
A front-end deployment that opted in to being told which content tags expired.

## Navigation

**Navigation location**:
Which menu an item belongs to: the header or the bottom bar. It decides whether items can nest and how many fit.

**Bottom bar**:
The mobile navigation location: flat, with at most three root items.

**Root item**:
An item with no effective parent. Only root items count toward a location's capacity, and only root items can be parents.

**Menu order**:
The full nested order of one location's items, as edited in the AdminCP.

**Placement**:
The parent and position one item takes when a menu order is applied.

## Dashboard widgets

**Widget definition**:
A widget a plugin provides to the AdminCP dashboard, with its size limits and whether it may be placed more than once.

**Widget instance**:
One card on the dashboard, identified by its widget and a copy number. Its settings belong to the instance.

**Span**:
A widget instance's width in grid columns, never below its definition's minimum.

**Layout**:
The ordered list of widget instances one admin arranged.

## Routes and messages

**Page declaration**:
The browser-safe entry that names a page's path, messages, pending skeleton and lazily loaded screen.

**Table contract**:
The description of an AdminCP list's URL: sorting, filters, search and default page size.

**Table screen**:
The only per-list code of an AdminCP table: the query it runs and the table it renders.

**Route messages**:
A named set of at most sixteen translation namespaces, declared once and used to preload and to provide translations.

**Namespace**:
A dotted path into the merged message tree, such as `admin.staff`.

**Host intl provider**:
The host app's own translation provider, registered with the core so core screens render inside it.

**Host route**:
A URL the host app answers with its own file route, rather than one a plugin provides.

**Plugin surface**:
Everything the configured plugins export, discovered in one pass. Every generated registry is rendered from it.

**Cookie relay**:
A host server copying the API's session cookies onto its own response. Core auth never needs one.
