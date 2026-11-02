import { deleteSlot, deserialize, listSlots, loadSlot, saveSlot, serialize, type SceneFile } from '../io/save';
import type { Simulation } from '../sim/simulation';
import { DEMOS } from '../io/demos';
import { shareUrl } from '../io/share';

export interface SceneHooks {
  /** Right before a scene replaces the world (for undo). */
  beforeLoad: () => void;
  /** After loading; demos pass their settings (e.g. wind). */
  afterLoad: (settings?: { wind: number }) => void;
}

/**
 * The scenes dialog: demo scenes, share link, named slots in localStorage
 * and file export/import.
 */
export function setupSavesDialog(sim: Simulation, hooks: SceneHooks): () => void {
  const dlg = document.getElementById('dlg-saves') as HTMLDialogElement;
  const nameInput = document.getElementById('save-name') as HTMLInputElement;
  const list = document.getElementById('save-list') as HTMLUListElement;
  const msg = document.getElementById('save-msg') as HTMLParagraphElement;
  const fileInput = document.getElementById('file-import') as HTMLInputElement;

  const say = (text: string, error = false) => {
    msg.textContent = text;
    msg.classList.toggle('error', error);
  };

  async function load(scene: SceneFile, label: string): Promise<void> {
    try {
      hooks.beforeLoad();
      await deserialize(sim, scene);
      hooks.afterLoad({ wind: 0 });
      say(`„${label}“ geladen.`);
      dlg.close();
    } catch (e) {
      say(`Laden fehlgeschlagen: ${(e as Error).message}`, true);
    }
  }

  function renderList(): void {
    const slots = listSlots();
    if (slots.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'Noch keine gespeicherten Szenen.';
      list.replaceChildren(li);
      return;
    }
    list.replaceChildren(
      ...slots.map((s) => {
        const li = document.createElement('li');
        const title = document.createElement('span');
        title.className = 'slot-name';
        title.textContent = s.name;
        const date = document.createElement('span');
        date.className = 'slot-date';
        date.textContent = new Date(s.date).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
        const loadBtn = document.createElement('button');
        loadBtn.type = 'button';
        loadBtn.textContent = 'Laden';
        loadBtn.addEventListener('click', () => {
          const scene = loadSlot(s.name);
          if (scene) void load(scene, s.name);
        });
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'danger';
        delBtn.textContent = 'Löschen';
        delBtn.addEventListener('click', () => {
          if (!confirm(`„${s.name}“ wirklich löschen?`)) return;
          deleteSlot(s.name);
          renderList();
        });
        li.append(title, date, loadBtn, delBtn);
        return li;
      }),
    );
  }

  document.getElementById('btn-save-slot')!.addEventListener('click', async () => {
    const name = nameInput.value.trim() || `Szene ${new Date().toLocaleString('de-DE')}`;
    try {
      saveSlot(name, await serialize(sim));
      say(`„${name}“ gespeichert.`);
      nameInput.value = '';
      renderList();
    } catch (e) {
      say(`Speichern fehlgeschlagen (Speicher voll?): ${(e as Error).message}`, true);
    }
  });

  document.getElementById('btn-export')!.addEventListener('click', async () => {
    const scene = await serialize(sim);
    const blob = new Blob([JSON.stringify(scene)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `szene-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.sandbox.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    say('Datei exportiert.');
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    try {
      const scene = JSON.parse(await file.text()) as SceneFile;
      await load(scene, file.name);
    } catch (e) {
      say(`Import fehlgeschlagen: ${(e as Error).message}`, true);
    }
  });

  // Demo scenes
  const demoList = document.getElementById('demo-list') as HTMLDivElement;
  demoList.replaceChildren(
    ...DEMOS.map((d) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'demo';
      b.title = d.description;
      b.textContent = d.label;
      b.addEventListener('click', () => {
        hooks.beforeLoad();
        sim.clear();
        const settings = d.build(sim);
        hooks.afterLoad(settings);
        say(`Demo „${d.label}“ geladen. ${d.description}`);
        dlg.close();
      });
      return b;
    }),
  );

  // Share via link
  document.getElementById('btn-share')!.addEventListener('click', async () => {
    try {
      const url = await shareUrl(sim);
      history.replaceState(null, '', url);
      let copied = false;
      try {
        await navigator.clipboard.writeText(url);
        copied = true;
      } catch {
        /* clipboard blocked: the URL is still in the address bar */
      }
      const kb = Math.round(url.length / 1024);
      say(
        `${copied ? 'Link kopiert' : 'Link steht in der Adresszeile'} (${kb} KB).` +
          (kb > 60 ? ' Sehr lang – manche Messenger kürzen so lange Links.' : ''),
      );
    } catch (e) {
      say(`Teilen fehlgeschlagen: ${(e as Error).message}`, true);
    }
  });

  return () => {
    say('');
    renderList();
    dlg.showModal();
  };
}
