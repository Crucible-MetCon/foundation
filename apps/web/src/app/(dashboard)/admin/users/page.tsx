"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { UserPlus, Edit2, UserX, X } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { DataTable, statusBadge } from "@/components/ui/data-table";
import { fmtDate } from "@/lib/utils";

// ── Types ──
interface UserRow {
  id: number;
  username: string;
  displayName: string | null;
  role: string;
  canRead: boolean;
  canWrite: boolean;
  isAdmin: boolean;
  isActive: boolean;
  createdAt: string;
}

interface UsersResponse {
  users: UserRow[];
  error?: string;
}

// ── Modal wrapper ──
function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-[var(--color-surface)] p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-background)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Shared form styles ──
const inputClass =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] outline-none";

const labelClass = "block text-sm font-medium text-[var(--color-text-secondary)] mb-1";

const primaryBtnClass =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors";

const neutralBtnClass =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-background)] disabled:opacity-50 transition-colors";

// ── Create User Form ──
function CreateUserForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("viewer");
  const [error, setError] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      const resp = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
          displayName: displayName.trim() || undefined,
          role,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Failed to create user");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      onSuccess();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim()) {
      setError("Username is required");
      return;
    }
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    createMutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>Username *</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={inputClass}
          placeholder="Enter username"
          autoFocus
        />
      </div>

      <div>
        <label className={labelClass}>Password *</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
          placeholder="Min 6 characters"
        />
      </div>

      <div>
        <label className={labelClass}>Display Name</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className={inputClass}
          placeholder="Optional display name"
        />
      </div>

      <div>
        <label className={labelClass}>Role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className={inputClass}
        >
          <option value="viewer">Viewer</option>
          <option value="write">Write</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={createMutation.isPending}
          className={neutralBtnClass}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={createMutation.isPending}
          className={primaryBtnClass}
        >
          {createMutation.isPending ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Creating...
            </>
          ) : (
            "Create User"
          )}
        </button>
      </div>
    </form>
  );
}

// ── Edit User Form ──
function EditUserForm({
  user,
  onSuccess,
  onCancel,
}: {
  user: UserRow;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [role, setRole] = useState(user.role);
  const [isActive, setIsActive] = useState(user.isActive);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const updateMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        displayName: displayName.trim() || null,
        role,
        isActive,
      };
      if (password) {
        body.password = password;
      }

      const resp = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Failed to update user");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      onSuccess();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password && password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    updateMutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>Username</label>
        <input
          type="text"
          value={user.username}
          disabled
          className={`${inputClass} opacity-60 cursor-not-allowed`}
        />
      </div>

      <div>
        <label className={labelClass}>Display Name</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className={inputClass}
          placeholder="Display name"
          autoFocus
        />
      </div>

      <div>
        <label className={labelClass}>Role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className={inputClass}
        >
          <option value="viewer">Viewer</option>
          <option value="write">Write</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="edit-active"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
        />
        <label
          htmlFor="edit-active"
          className="text-sm text-[var(--color-text-secondary)]"
        >
          Active
        </label>
      </div>

      <div>
        <label className={labelClass}>New Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
          placeholder="Leave blank to keep current"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={updateMutation.isPending}
          className={neutralBtnClass}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={updateMutation.isPending}
          className={primaryBtnClass}
        >
          {updateMutation.isPending ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </button>
      </div>
    </form>
  );
}

// ── Main Page ──
export default function UserManagementPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<UserRow | null>(null);

  // Fetch users
  const { data, isLoading, error } = useQuery<UsersResponse>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const resp = await fetch("/api/admin/users");
      if (!resp.ok) throw new Error("Failed to load users");
      return resp.json();
    },
  });

  // Deactivate mutation
  const deactivateMutation = useMutation({
    mutationFn: async (userId: number) => {
      const resp = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || "Failed to deactivate user");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setConfirmDeactivate(null);
    },
  });

  const users = data?.users ?? [];

  // Table columns
  const columns = useMemo<ColumnDef<UserRow, any>[]>(
    () => [
      {
        accessorKey: "username",
        header: "Username",
        size: 160,
        cell: ({ getValue }) => (
          <span className="font-medium text-[var(--color-text-primary)]">
            {getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "displayName",
        header: "Display Name",
        size: 180,
        cell: ({ getValue }) => (getValue() as string) || "-",
      },
      {
        accessorKey: "role",
        header: "Role",
        size: 100,
        cell: ({ getValue }) => {
          const role = getValue() as string;
          const variant =
            role === "admin"
              ? "danger"
              : role === "write"
                ? "warning"
                : "neutral";
          return statusBadge(role, variant);
        },
      },
      {
        accessorKey: "isActive",
        header: "Status",
        size: 100,
        cell: ({ getValue }) => {
          const active = getValue() as boolean;
          return statusBadge(
            active ? "Active" : "Inactive",
            active ? "success" : "danger"
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        size: 120,
        cell: ({ getValue }) => fmtDate(getValue() as string),
      },
      {
        id: "actions",
        header: "Actions",
        size: 100,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditUser(row.original);
              }}
              className="rounded-md p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-background)] hover:text-[var(--color-text-primary)] transition-colors"
              title="Edit user"
            >
              <Edit2 size={14} />
            </button>
            {row.original.isActive && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDeactivate(row.original);
                }}
                className="rounded-md p-1.5 text-[var(--color-text-secondary)] hover:bg-red-50 hover:text-red-600 transition-colors"
                title="Deactivate user"
              >
                <UserX size={14} />
              </button>
            )}
          </div>
        ),
      },
    ],
    []
  );

  return (
    <PageShell
      title="User Management"
      description="Manage user accounts and permissions."
      actions={
        <button
          onClick={() => setShowCreate(true)}
          className={primaryBtnClass}
        >
          <UserPlus size={16} />
          Add User
        </button>
      }
    >
      {/* Users DataTable */}
      <DataTable
        columns={columns}
        data={users}
        loading={isLoading}
        paginate
        pageSize={50}
        searchable
        searchColumn="username"
        searchPlaceholder="Search by username..."
        stickyHeader
        maxHeight="calc(100vh - 300px)"
        emptyMessage={
          error
            ? "Failed to load users."
            : "No users found."
        }
        initialSorting={[{ id: "username", desc: false }]}
      />

      {/* Create User Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create New User"
      >
        <CreateUserForm
          onSuccess={() => setShowCreate(false)}
          onCancel={() => setShowCreate(false)}
        />
      </Modal>

      {/* Edit User Modal */}
      <Modal
        open={editUser !== null}
        onClose={() => setEditUser(null)}
        title="Edit User"
      >
        {editUser && (
          <EditUserForm
            key={editUser.id}
            user={editUser}
            onSuccess={() => setEditUser(null)}
            onCancel={() => setEditUser(null)}
          />
        )}
      </Modal>

      {/* Deactivate Confirmation Modal */}
      {confirmDeactivate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-xl bg-[var(--color-surface)] p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Deactivate User
            </h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Are you sure you want to deactivate{" "}
              <span className="font-medium text-[var(--color-text-primary)]">
                {confirmDeactivate.username}
              </span>
              ? They will no longer be able to log in.
            </p>

            {deactivateMutation.isError && (
              <p className="mt-3 text-sm text-red-600">
                {deactivateMutation.error?.message || "Failed to deactivate user"}
              </p>
            )}

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmDeactivate(null)}
                disabled={deactivateMutation.isPending}
                className={neutralBtnClass}
              >
                Cancel
              </button>
              <button
                onClick={() => deactivateMutation.mutate(confirmDeactivate.id)}
                disabled={deactivateMutation.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deactivateMutation.isPending ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Deactivating...
                  </>
                ) : (
                  "Deactivate"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
