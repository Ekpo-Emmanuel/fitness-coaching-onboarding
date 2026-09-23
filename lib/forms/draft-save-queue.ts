export type DraftSaveState = "saved" | "unsaved" | "saving" | "error" | "conflict";
export type SaveResult<T> = { ok: true; revision: number; value: T } | { ok: false; error: string; conflict?: boolean };

/** Serializes writes and never replaces edits made while a request is in flight. */
export class DraftSaveQueue<T> {
  value: T;
  revision: number;
  state: DraftSaveState = "saved";
  error = "";
  recovered = false;
  private generation = 0;
  private savedGeneration = 0;
  private running: Promise<void> | null = null;
  constructor(value: T, revision: number, private write: (value: T, revision: number) => Promise<SaveResult<T>>, private notify: () => void) {
    this.value = value; this.revision = revision;
  }
  get dirty() { return this.generation !== this.savedGeneration; }
  edit(value: T) { this.value = value; this.generation++; if (this.state !== "conflict") this.state = "unsaved"; this.notify(); }
  restore(value: T, baseRevision: number) {
    this.recovered = true;
    this.edit(value);
    if (baseRevision !== this.revision) { this.state = "conflict"; this.error = "The saved draft changed while these edits were on this device."; this.notify(); }
  }
  replace(value: T, revision: number) {
    if (this.running) throw new Error("Wait for the current save to finish.");
    this.value = value; this.revision = revision; this.generation++; this.savedGeneration = this.generation; this.state = "saved"; this.error = ""; this.notify();
  }
  flush(): Promise<void> {
    if (this.running) return this.running;
    if (this.state === "conflict") return Promise.reject(new Error(this.error));
    if (!this.dirty) return Promise.resolve();
    this.running = this.drain().finally(() => { this.running = null; });
    return this.running;
  }
  private async drain() {
    while (this.dirty) {
      const sentGeneration = this.generation;
      const sent = this.value;
      this.state = "saving"; this.error = ""; this.notify();
      try {
        const result = await this.write(sent, this.revision);
        if (!result.ok) {
          this.state = result.conflict ? "conflict" : "error"; this.error = result.error; this.notify();
          throw new Error(result.error);
        }
        this.revision = result.revision;
        this.savedGeneration = sentGeneration;
        if (this.generation === sentGeneration) this.value = result.value;
      } catch (error) {
        if (this.state !== "conflict") this.state = "error";
        this.error ||= error instanceof Error ? error.message : "Could not save. Your edits are still here.";
        this.notify(); throw error;
      }
    }
    this.state = "saved"; this.error = ""; this.recovered = false; this.notify();
  }
}
