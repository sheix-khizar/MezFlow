## Task: Implement Clerk-Based Manager Registration for MezFlow

Implement a complete Clerk-based manager registration and restaurant workspace onboarding flow.

### 1. Registration Flow

Replace the existing direct password-based manager registration flow with:

1. Manager opens `/signup`.
2. Manager enters their name, email address, and restaurant information.
3. Clerk sends a six-digit email verification code.
4. Manager verifies the code.
5. After successful verification, the frontend obtains the authenticated Clerk session.
6. Frontend securely sends the Clerk session token and restaurant details to FastAPI.
7. Backend verifies the Clerk JWT.
8. Backend creates or synchronizes the PostgreSQL user.
9. Backend creates the restaurant workspace and assigns the registering user as its owner/manager.
10. Backend provisions the default dining tables and starter menu categories.
11. Manager is redirected to `/admin`.

### 2. Backend Integration

- Implement secure Clerk JWT verification in FastAPI.
- Validate issuer, signature, expiration and authorized audience where configured.
- Use Clerk's immutable user ID as the external identity reference.
- Synchronize Clerk users with PostgreSQL using idempotent operations.
- Prevent duplicate users and duplicate restaurant creation.
- Assign the correct restaurant ownership and manager role server-side.
- Never trust frontend-supplied user IDs, restaurant ownership or role assignments.
- Use database transactions for workspace provisioning.
- Ensure failed registration does not leave incomplete restaurant records.

### 3. Multi-Tenant Security

- Every restaurant must have isolated data.
- Verify restaurant membership on every protected API.
- Prevent managers from accessing another restaurant's data.
- Do not treat a valid Clerk login as automatic authorization for every restaurant.
- Preserve existing role-based access controls.

### 4. Google Sign-In

Keep Google Sign-In available through Clerk.

A manager should be able to register using either:
- Email OTP.
- Google Sign-In.

Both methods must result in the same secure backend user synchronization and restaurant onboarding process.

### 5. Existing Authentication Compatibility

- Inspect the existing password-based registration and login implementation first.
- Do not blindly delete existing authentication code.
- Preserve existing accounts and their password-login functionality during migration.
- Do not break existing manager, waiter, cashier or KDS workflows.
- Restrict development-only quick-role switching to local/demo environments.
- Document the migration strategy before removing legacy authentication.

### 6. Frontend Experience

Create a professional registration experience with:
- Restaurant information form.
- Clerk email verification.
- Google Sign-In.
- Loading and verification states.
- Clear error messages.
- Duplicate email handling.
- Successful registration confirmation.
- Safe redirect to the manager dashboard.

Do not create the restaurant before email verification succeeds.

### 7. Environment Configuration

Inspect the existing environment variables and document all required Clerk configuration.

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

Configure backend verification using the appropriate Clerk JWKS/issuer configuration.

Never expose secret keys in browser code, logs, Git commits or public environment variables.

### 8. Testing and Verification

Test:

- Successful email OTP registration.
- Successful Google registration.
- Invalid and expired Clerk tokens.
- Duplicate registration attempts.
- Existing account handling.
- Restaurant ownership assignment.
- Correct manager permissions.
- Cross-restaurant access denial.
- Failed workspace creation and transaction rollback.
- Existing password login compatibility.
- Frontend TypeScript checks.
- Backend pytest suite.

### 9. Documentation and Completion Report

Update `AGENT_LOG.md` and document:

- Files created and modified.
- Authentication architecture.
- Database changes and migrations.
- Environment configuration.
- Tests executed and their actual results.
- Remaining limitations.
- Deployment requirements.

### Important Instructions

- First inspect the existing implementation.
- Reuse working components and services wherever possible.
- Do not introduce a second independent authentication system.
- Do not hardcode demo credentials or production secrets.
- Do not claim successful email delivery without testing an actual email.
- Do not claim production readiness based only on local tests.
- Do not push to GitHub without approval.

Complete the implementation incrementally. If an architectural or database decision could affect existing accounts, stop and explain the decision before proceeding.