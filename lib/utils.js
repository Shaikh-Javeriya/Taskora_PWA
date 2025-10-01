import { clsx } from "clsx";
import { saveAs } from "file-saver";
import Papa from "papaparse";
import db, { dbOperations } from "./database";
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

  if (data.projects) await db.projects.bulkPut(data.projects);
  if (data.tasks) await db.tasks.bulkPut(data.tasks);
  if (data.timeEntries) await db.time_entries.bulkPut(data.timeEntries);

  return true;
}


// Import CSV (tasks only for now)
export async function importCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        try {
          const tasks = results.data.map(row => ({
            title: row.Task,
            status: row.Status || "todo",
            actual_hours: parseFloat(row.Hours || 0),
            billable: row.Billable === "Yes",
            deadline: row.DueDate || null,
            project_id: null // TODO: map Project name → project_id if you want
          }));
          await db.tasks.bulkPut(tasks);
          resolve(true);
        } catch (err) {
          reject(err);
        }
      },
      error: reject,
    });
  });
}