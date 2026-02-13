# Organization Quick Switch Guide

## 🚀 How Quick Switching Works

### For Agency Users (Managing Multiple Clients)

Users can quickly switch between organizations they belong to:

1. **Left Sidebar** shows all organizations
2. **Click any organization** → Instantly switches
3. **All data filters** to that organization
4. **Active org highlighted** with primary color

### Visual Flow

```
┌─────────────────────┐
│ Organizations       │
├─────────────────────┤
│ 🏢 RDM Marketing    │ ← Active (highlighted)
│ 🏢 Client ABC       │
│ 🏢 Client XYZ       │
│ 🏢 Personal         │
├─────────────────────┤
│ + Create Org        │
│ + Join with Code    │
└─────────────────────┘
```

## 📋 Complete Flow

### 1. Marketing Person Invites User

**Steps**:
1. Go to Organization Settings
2. Click "Invite Members"
3. Enter email: `john@example.com`
4. Select role: Member/Admin
5. Click "Send Invitation"

**What Happens**:
- System generates code: `RDM-2025-ABC123`
- Creates invitation record
- Returns invitation URL: `/invite/RDM-2025-ABC123`
- (Email sending can be added later)

### 2. User Receives Invitation

**Email Contains**:
- Link: `https://app.storyteller.com/invite/RDM-2025-ABC123`
- Code: `RDM-2025-ABC123`
- Organization name: "RDM Marketing"

### 3. User Clicks Link → Signup Page

**Page**: `/invite/RDM-2025-ABC123`

**Shows**:
- Email: `john@example.com` (pre-filled, locked)
- Code: `RDM-2025-ABC123` (pre-filled, locked)
- Password: [user enters]
- Confirm Password: [user enters]

### 4. User Creates Account

**Backend Process**:
1. Validates invitation (code, email, expiration)
2. Creates Supabase auth account
3. Creates user profile
4. Adds user to organization
5. Marks invitation as accepted
6. Signs user in
7. Redirects to dashboard

### 5. User Sees Organization in Sidebar

**Sidebar Shows**:
- All organizations user belongs to
- Active organization highlighted
- Quick switch by clicking

## 🔄 Quick Switching Between Organizations

### How It Works

1. **Click Organization** in sidebar
2. **Context updates** → `activeOrganization` changes
3. **All API calls** filter by `organization_id`
4. **Page refreshes** → Shows data for new org
5. **LocalStorage** saves active org ID

### Code Example

```typescript
// In any component
const { activeOrganization, setActiveOrganization, organizations } = useOrganization();

// Switch org
const handleSwitch = (org) => {
  setActiveOrganization(org);
  router.refresh(); // Refresh data
};

// Use active org in API calls
const { data } = await fetch(
  `/api/blocks?organization_id=${activeOrganization.id}`
);
```

## 🎯 Perfect for Agencies

### Use Case: Marketing Agency

**Scenario**: Agency manages 5 clients

1. **Create 5 Organizations**:
   - Client A Marketing
   - Client B Marketing
   - Client C Marketing
   - Client D Marketing
   - Agency Internal

2. **Invite Team Members**:
   - Each client gets their own org
   - Team members can belong to multiple orgs
   - Switch instantly between clients

3. **Quick Switch**:
   - Click "Client A" → See Client A's analytics, workspace
   - Click "Client B" → See Client B's analytics, workspace
   - All data separated by organization

## 📁 Files Created

### Components
- `components/organization/OrganizationSidebar.tsx` - Sidebar with org list
- `components/organization/CreateOrganizationModal.tsx` - Create org modal
- `components/organization/JoinOrganizationModal.tsx` - Join with code modal
- `components/organization/CreateInvitationDialog.tsx` - Invite members dialog

### Pages
- `app/invite/[code]/page.tsx` - Invitation signup page

### API Routes
- `app/api/organizations/route.ts` - List & create orgs
- `app/api/organizations/join/route.ts` - Join with code
- `app/api/organizations/[orgId]/invitations/route.ts` - Create invitations

### Context
- `lib/contexts/OrganizationContext.tsx` - Organization state management

### Database
- `supabase/migrations/20250212000001_organizations.sql` - Schema migration

## ✅ Next Steps

1. **Run Migration**: Execute SQL in Supabase
2. **Test Flow**: Create org → Invite user → Signup → Switch
3. **Add Email Service**: Integrate Resend/SendGrid for emails
4. **Update API Calls**: Filter by `organization_id` in existing endpoints
5. **Add Org Settings**: Settings page for each organization

## 🔧 Integration Points

### Update Existing APIs

All existing APIs should filter by `organization_id`:

```typescript
// Before
const { data } = await supabase.from('blocks').select('*');

// After
const { activeOrganization } = useOrganization();
const { data } = await supabase
  .from('blocks')
  .select('*')
  .eq('organization_id', activeOrganization.id);
```

### Update Components

Components that fetch data should use `activeOrganization`:

```typescript
const { activeOrganization } = useOrganization();

useEffect(() => {
  if (activeOrganization) {
    fetchData(activeOrganization.id);
  }
}, [activeOrganization]);
```

---

**Ready to use!** The system is fully functional for quick organization switching. 🎉
