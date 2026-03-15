"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { Plus, Edit2, Trash2, X } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { DataTable, statusBadge } from "@/components/ui/data-table";
import { fmtDate } from "@/lib/utils";

// ── Types ──
interface TaskRow {
  id: number;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  createdBy: number;
  assignedTo: number | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  creatorName: string;
  assigneeName: string | null;
}

interface UserOption {
  id: number;
  displayName: string | null;
  username: string;
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

// ── Create Task Form ──
function CreateTaskForm({
  users,
  onSuccess,
  onCancel,
}: {
  users: UserOption[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("enhancement");
  const [priority, setPriority] = useState("medium");
  const [assignedTo, setAssignedTo] = useState("");
  const [error, setError] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      const resp = await fetch("/api/admin/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          type,
          priority,
          assignedTo: assignedTo ? parseInt(assignedTo, 10) : undefined,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Failed to create task");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tasks"] });
      onSuccess();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    createMutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>Title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
          placeholder="Brief description of the task"
          autoFocus
        />
      </div>

      <div>
        <label className={labelClass}>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={`${inputClass} min-h-[80px] resize-y`}
          placeholder="Detailed description (optional)"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={inputClass}
          >
            <option value="enhancement">Enhancement</option>
            <option value="bug">Bug</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className={inputClass}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>Assigned To</label>
        <select
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          className={inputClass}
        >
          <option value="">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.displayName || u.username}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

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
            "Create Task"
          )}
        </button>
      </div>
    </form>
  );
}

// ── Edit Task Form ──
function EditTaskForm({
  task,
  users,
  onSuccess,
  onCancel,
}: {
  task: TaskRow;
  users: UserOption[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [type, setType] = useState(task.type);
  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState(task.priority);
  const [assignedTo, setAssignedTo] = useState(
    task.assignedTo ? String(task.assignedTo) : "",
  );
  const [error, setError] = useState("");

  const updateMutation = useMutation({
    mutationFn: async () => {
      const resp = await fetch(`/api/admin/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          type,
          status,
          priority,
          assignedTo: assignedTo ? parseInt(assignedTo, 10) : null,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Failed to update task");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tasks"] });
      onSuccess();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    updateMutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>Title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
          autoFocus
        />
      </div>

      <div>
        <label className={labelClass}>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={`${inputClass} min-h-[80px] resize-y`}
          placeholder="Detailed description (optional)"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={inputClass}
          >
            <option value="enhancement">Enhancement</option>
            <option value="bug">Bug</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={inputClass}
          >
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className={inputClass}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>Assigned To</label>
        <select
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          className={inputClass}
        >
          <option value="">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.displayName || u.username}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

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
export default function DevTasksPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editTask, setEditTask] = useState<TaskRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TaskRow | null>(null);

  // Fetch tasks
  const { data, isLoading, error } = useQuery<{ tasks: TaskRow[] }>({
    queryKey: ["admin-tasks"],
    queryFn: async () => {
      const resp = await fetch("/api/admin/tasks");
      if (!resp.ok) throw new Error("Failed to load tasks");
      return resp.json();
    },
  });

  // Fetch users for assignment dropdown
  const { data: usersData } = useQuery<{ users: UserOption[] }>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const resp = await fetch("/api/admin/users");
      if (!resp.ok) throw new Error("Failed to load users");
      return resp.json();
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (taskId: number) => {
      const resp = await fetch(`/api/admin/tasks/${taskId}`, {
        method: "DELETE",
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || "Failed to delete task");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tasks"] });
      setConfirmDelete(null);
    },
  });

  const tasks = data?.tasks ?? [];
  const userOptions = usersData?.users ?? [];

  // Table columns
  const columns = useMemo<ColumnDef<TaskRow, any>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Title",
        size: 300,
        cell: ({ getValue, row }) => (
          <div>
            <span className="font-medium text-[var(--color-text-primary)]">
              {getValue() as string}
            </span>
            {row.original.description && (
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)] line-clamp-1">
                {row.original.description}
              </p>
            )}
          </div>
        ),
      },
      {
        accessorKey: "type",
        header: "Type",
        size: 110,
        cell: ({ getValue }) => {
          const type = getValue() as string;
          return statusBadge(
            type,
            type === "bug" ? "danger" : "neutral",
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 120,
        cell: ({ getValue }) => {
          const status = getValue() as string;
          const label = status === "in_progress" ? "In Progress" : status;
          const variant =
            status === "completed"
              ? "success"
              : status === "in_progress"
                ? "warning"
                : "neutral";
          return statusBadge(label, variant);
        },
      },
      {
        accessorKey: "priority",
        header: "Priority",
        size: 100,
        cell: ({ getValue }) => {
          const priority = getValue() as string;
          const variant =
            priority === "critical"
              ? "danger"
              : priority === "high"
                ? "warning"
                : priority === "low"
                  ? "success"
                  : "neutral";
          return statusBadge(priority, variant);
        },
      },
      {
        accessorKey: "assigneeName",
        header: "Assigned To",
        size: 140,
        cell: ({ getValue }) => {
          const name = getValue() as string | null;
          return name || (
            <span className="text-[var(--color-text-muted)]">Unassigned</span>
          );
        },
      },
      {
        accessorKey: "creatorName",
        header: "Created By",
        size: 120,
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        size: 110,
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
                setEditTask(row.original);
              }}
              className="rounded-md p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-background)] hover:text-[var(--color-text-primary)] transition-colors"
              title="Edit task"
            >
              <Edit2 size={14} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConfirmDelete(row.original);
              }}
              className="rounded-md p-1.5 text-[var(--color-text-secondary)] hover:bg-red-50 hover:text-red-600 transition-colors"
              title="Delete task"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <PageShell
      title="Dev Tasks"
      description="Track bugs and enhancement requests."
      actions={
        <button
          onClick={() => setShowCreate(true)}
          className={primaryBtnClass}
        >
          <Plus size={16} />
          Add Task
        </button>
      }
    >
      <DataTable
        columns={columns}
        data={tasks}
        loading={isLoading}
        paginate
        pageSize={25}
        searchable
        searchColumn="title"
        searchPlaceholder="Search tasks..."
        stickyHeader
        maxHeight="calc(100vh - 300px)"
        emptyMessage={
          error ? "Failed to load tasks." : "No tasks found."
        }
        initialSorting={[{ id: "createdAt", desc: true }]}
      />

      {/* Create Task Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create New Task"
      >
        <CreateTaskForm
          users={userOptions}
          onSuccess={() => setShowCreate(false)}
          onCancel={() => setShowCreate(false)}
        />
      </Modal>

      {/* Edit Task Modal */}
      <Modal
        open={editTask !== null}
        onClose={() => setEditTask(null)}
        title="Edit Task"
      >
        {editTask && (
          <EditTaskForm
            key={editTask.id}
            task={editTask}
            users={userOptions}
            onSuccess={() => setEditTask(null)}
            onCancel={() => setEditTask(null)}
          />
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-xl bg-[var(--color-surface)] p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Delete Task
            </h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Are you sure you want to delete{" "}
              <span className="font-medium text-[var(--color-text-primary)]">
                {confirmDelete.title}
              </span>
              ? This action cannot be undone.
            </p>

            {deleteMutation.isError && (
              <p className="mt-3 text-sm text-red-600">
                {deleteMutation.error?.message || "Failed to delete task"}
              </p>
            )}

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleteMutation.isPending}
                className={neutralBtnClass}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(confirmDelete.id)}
                disabled={deleteMutation.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleteMutation.isPending ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
