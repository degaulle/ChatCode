import { readFile, writeFile, readdir, unlink, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECTS_DIR = join(__dirname, '..', '..', 'projects');

// Ensure projects directory exists
await mkdir(PROJECTS_DIR, { recursive: true }).catch(() => {});

export class ProjectManager {
  /**
   * Save a project to disk.
   */
  async saveProject(name, data) {
    const safeName = this._sanitize(name);
    const filePath = join(PROJECTS_DIR, `${safeName}.json`);
    const project = {
      ...data,
      name: safeName,
      savedAt: new Date().toISOString(),
    };
    await writeFile(filePath, JSON.stringify(project, null, 2));
    return project;
  }

  /**
   * Load a project from disk.
   */
  async loadProject(name) {
    const safeName = this._sanitize(name);
    const filePath = join(PROJECTS_DIR, `${safeName}.json`);
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  }

  /**
   * List all saved projects.
   */
  async listProjects() {
    const files = await readdir(PROJECTS_DIR);
    const projects = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = await readFile(join(PROJECTS_DIR, file), 'utf-8');
        const data = JSON.parse(raw);
        projects.push({
          name: data.name || file.replace('.json', ''),
          savedAt: data.savedAt || null,
        });
      } catch {}
    }

    return projects.sort((a, b) => {
      if (!a.savedAt) return 1;
      if (!b.savedAt) return -1;
      return new Date(b.savedAt) - new Date(a.savedAt);
    });
  }

  /**
   * Delete a project.
   */
  async deleteProject(name) {
    const safeName = this._sanitize(name);
    const filePath = join(PROJECTS_DIR, `${safeName}.json`);
    await unlink(filePath);
  }

  _sanitize(name) {
    return name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100);
  }
}
