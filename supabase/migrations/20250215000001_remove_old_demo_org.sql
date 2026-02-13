-- Remove the old seed demo organization (00000000-...) and its data.
-- New users now see the real org 1305bb82-5c49-4e27-bccd-9c942fa7fb06 (public_demo_organization_id) read-only.

DELETE FROM content_approvals WHERE organization_id = '00000000-0000-0000-0000-000000000000'::uuid;
DELETE FROM vector_chunks WHERE block_id IN (SELECT id FROM blocks WHERE organization_id = '00000000-0000-0000-0000-000000000000'::uuid);
DELETE FROM sub_blocks WHERE organization_id = '00000000-0000-0000-0000-000000000000'::uuid;
DELETE FROM documents WHERE organization_id = '00000000-0000-0000-0000-000000000000'::uuid;
DELETE FROM blocks WHERE organization_id = '00000000-0000-0000-0000-000000000000'::uuid;
DELETE FROM organization_members WHERE organization_id = '00000000-0000-0000-0000-000000000000'::uuid;
DELETE FROM access_requests WHERE organization_id = '00000000-0000-0000-0000-000000000000'::uuid;
DELETE FROM organizations WHERE id = '00000000-0000-0000-0000-000000000000'::uuid;
