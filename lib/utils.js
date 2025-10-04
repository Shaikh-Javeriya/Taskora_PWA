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

  if (data.projects) await db.projects.bulkAdd(data.projects);
  if (data.tasks) await db.tasks.bulkAdd(data.tasks);
  if (data.timeEntries) await db.time_entries.bulkAdd(data.timeEntries);

  return true;
}


export async function importCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        try {
          if (!results.data || results.data.length === 0) {
            return reject(new Error("CSV is empty"));
          }
          const cleanData = results.data.filter(row => {
            return Object.values(row).some(value => value && value.toString().trim() !== "");
          });
          const headers = Object.keys(results.data[0]);

          if (headers.includes("Project Id")) {
            // Import as tasks
            for (const row of cleanData) {
              await dbOperations.createTask({
                title: row.Title || "",
                status: row.Status?.toLowerCase() || "todo",
                estimated_hours: parseFloat(row["Actual Hours"]) || 0,
                billable_hours: parseFloat(row.Billable) || 0,
                deadline: row.Deadline || null,
                project_id: parseInt(row["Project Id"], 10),
              });
            }
            // 🔥 trigger a reload so Kanban sees new tasks
            if (typeof window !== "undefined") {
              await dbOperations.createTask({...});
              window.dispatchEvent(new Event("dataUpdated")); 
            }
            toast.success("✅ Tasks imported successfully!");
          } else {
            // Import as projects
            const projects = cleanData.map(row => ({
              name: row.Title?.trim(),
              status: row.Status?.trim() || "active",
              actual_hours: parseFloat(row["Actual Hours"] || 0),
              billable: parseFloat(row.Billable || 0),
              deadline: row.Deadline ? new Date(row.Deadline) : null,
              created_at: new Date(),
              updated_at: new Date()
            }));
            await db.projects.bulkPut(projects);
            toast.success(`Imported ${projects.length} projects`);
          }

          resolve(true);
        } catch (err) {
          reject(err);
        }
      },
      error: reject,
    });
  });
}
