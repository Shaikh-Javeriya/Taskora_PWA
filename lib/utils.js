import { clsx } from "clsx";
import { saveAs } from "file-saver";
import Papa from "papaparse";
import db, { dbOperations } from "./database";
import { toast } from "sonner";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
export async function exportCSV() {
  const projects = await dbOperations.getProjects();
  const tasks = await dbOperations.getTasks();

  const taskData = tasks.map(t => ({
    Project: projects.find(p => p.id === t.project_id)?.name || "Unknown",
    Task: t.title,
    Status: t.status,
    Hours: t.actual_hours || 0,
    Billable: t.billable ? "Yes" : "No",
    DueDate: t.deadline || ""
  }));

  const csv = Papa.unparse(taskData);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  saveAs(blob, "tasks_export.csv");
}


// Export full backup as JSON
export async function exportJSON() {
  const projects = await dbOperations.getProjects();
  const tasks = await dbOperations.getTasks();
  const timeEntries = await dbOperations.getTimeEntries();

  const data = { projects, tasks, timeEntries };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8;",
  });
  saveAs(blob, "taskora_backup.json");
}


// === IMPORT FUNCTIONS ===

// Import JSON backup
export async function importJSON(file) {
  const text = await file.text();
  const data = JSON.parse(text);

  // use bulkPut so it updates or inserts without constraint errors
  if (data.projects && data.projects.length > 0) {
    await db.projects.bulkPut(data.projects);
  }
  if (data.tasks && data.tasks.length > 0) {
    await db.tasks.bulkPut(data.tasks);
  }
  if (data.timeEntries && data.timeEntries.length > 0) {
    await db.time_entries.bulkPut(data.timeEntries);
  }

  // trigger reload so Kanban/Overview refresh
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("dataUpdated"));
  }

  return true;
}

const normalizeProjectStatus = (raw) => {
  if (!raw) return "active";
  const s = String(raw).toLowerCase().trim();

  if (s === "done" || s === "completed" || s === "complete") return "completed";
  // anything else (todo, in-progress, active, etc.) counts as active
  return "active";
};

// Helper: canonicalize status strings to your app's statuses
const normalizeStatusForDB = (raw) => {
  if (!raw) return "todo";
  const s = String(raw).toLowerCase().trim();

  if (s === "todo" || s === "to do" || s === "to-do" || s === "td") return "todo";
  if (s === "in-progress" || s === "in progress" || s === "inprogress" || s === "in progress") return "in-progress";
  if (s === "done" || s === "complete" || s === "completed") return "done";
  // fallback
  return "todo";
};

// Small helper to get row value case-insensitive
const getRowValue = (row, results, keyName) => {
  // find header key that matches case-insensitively
  const found = Object.keys(results.data[0]).find(k => k.toLowerCase().trim() === keyName.toLowerCase().trim());
  return found ? row[found] : undefined;
};

export async function importCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          if (!results.data || results.data.length === 0) {
            return reject(new Error("CSV is empty"));
          }

          // remove empty rows
          const cleanData = results.data.filter(row =>
            Object.values(row).some(value =>
              value !== null && value !== undefined && String(value).trim() !== ""
            )
          );

          const headers = Object.keys(results.data[0] || {}).map(h => h.toLowerCase().trim());
          const hasProjectId = headers.some(h => h === "project id" || h === "project_id" || h === "projectid");

          if (hasProjectId) {
            // === Import as tasks ===
            for (const row of cleanData) {
              // get values with your getRowValue
              const rawProjectId = getRowValue(row, results, "Project Id") ?? getRowValue(row, results, "project_id");
              const rawTitle = getRowValue(row, results, "Title") ?? getRowValue(row, results, "title");
              const rawStatus = getRowValue(row, results, "Status") ?? getRowValue(row, results, "status");
              const rawActual = getRowValue(row, results, "Actual Hours") ?? getRowValue(row, results, "actual hours");
              const rawBillable = getRowValue(row, results, "Billable") ?? getRowValue(row, results, "billable");
              const rawDeadline = getRowValue(row, results, "Deadline") ?? getRowValue(row, results, "deadline");
              const rawPriority = getRowValue(row, results, "Priority") ?? getRowValue(row, results, "priority");
              const rawDescription = getRowValue(row, results, "Description") ?? getRowValue(row, results, "description");

              const projectId = rawProjectId ? parseInt(String(rawProjectId).trim(), 10) : null;
              if (!projectId && projectId !== 0) {
                console.warn("Skipping task row without valid Project Id:", row);
                continue;
              }

              const status = normalizeStatusForDB(rawStatus);
              const title = rawTitle ? String(rawTitle).trim() : "Untitled Task";
              const priority = rawPriority ? String(rawPriority).trim() : "medium";

              const estimated_hours = rawActual
                ? parseFloat(String(rawActual).replace(/[^0-9.\-]/g, "")) || 0
                : 0;

              const billable_hours = rawBillable
                ? parseFloat(String(rawBillable).replace(/[^0-9.\-]/g, "")) || 0
                : 0;

              let deadline = null;
              if (rawDeadline) {
                const parsed = new Date(rawDeadline);
                if (!isNaN(parsed.getTime())) deadline = parsed;
              }

              // Create the task
              const taskId = await dbOperations.createTask({
                title,
                status,
                priority,
                estimated_hours,
                billable_hours,
                deadline,
                project_id: projectId,
                description: rawDescription || ""
              });

              // === Create linked time_entries ===
              // === Create linked time_entries ===
if (estimated_hours > 0) {
  const durationSeconds = estimated_hours * 3600; // convert hours → seconds

  if (billable_hours > 0 && billable_hours < estimated_hours) {
    const billableSec = billable_hours * 3600;
    const nonBillableSec = (estimated_hours - billable_hours) * 3600;

    await dbOperations.createTimeEntry({
      task_id: taskId,
      project_id: projectId,
      duration: billableSec,
      billable: true,
      start_time: new Date(),
      end_time: new Date(),
      description: "Imported (billable)"
    });

    await dbOperations.createTimeEntry({
      task_id: taskId,
      project_id: projectId,
      duration: nonBillableSec,
      billable: false,
      start_time: new Date(),
      end_time: new Date(),
      description: "Imported (non-billable)"
    });

  } else {
    await dbOperations.createTimeEntry({
      task_id: taskId,
      project_id: projectId,
      duration: durationSeconds,
      billable: billable_hours > 0,
      start_time: new Date(),
      end_time: new Date(),
      description: "Imported from CSV"
    });
  }
}

            }

            if (typeof window !== "undefined") {
              window.dispatchEvent(new Event("dataUpdated"));
            }
            toast?.success?.("✅ Tasks imported successfully!");
          } else {
            // === Import as projects ===
            const projects = cleanData.map(row => {
              const rawTitle = getRowValue(row, results, "Title") ?? getRowValue(row, results, "title");
              const rawStatus = getRowValue(row, results, "Status") ?? getRowValue(row, results, "status");
              const rawActual = getRowValue(row, results, "Actual Hours") ?? getRowValue(row, results, "actual hours");
              const rawBillable = getRowValue(row, results, "Billable") ?? getRowValue(row, results, "billable");
              const rawDeadline = getRowValue(row, results, "Deadline") ?? getRowValue(row, results, "deadline");

              let deadline = null;
              if (rawDeadline) {
                const parsed = new Date(rawDeadline);
                if (!isNaN(parsed.getTime())) deadline = parsed;
              }

              return {
                name: rawTitle ? String(rawTitle).trim() : "Untitled Project",
                status: normalizeProjectStatus(rawStatus),
                actual_hours: rawActual
                  ? parseFloat(String(rawActual).replace(/[^0-9.\-]/g, "")) || 0
                  : 0,
                billable_hours: rawBillable
                  ? parseFloat(String(rawBillable).replace(/[^0-9.\-]/g, "")) || 0
                  : 0,
                deadline,
                created_at: new Date(),
                updated_at: new Date()
              };
            });

            await db.projects.bulkPut(projects);
            toast?.success?.(`✅ Imported ${projects.length} projects`);
            if (typeof window !== "undefined") {
              window.dispatchEvent(new Event("dataUpdated"));
            }
          }

          resolve(true);
        } catch (err) {
          console.error("Import CSV error:", err);
          reject(err);
        }
      },
      error: (err) => reject(err),
    });
  });
}


