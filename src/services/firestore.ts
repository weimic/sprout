import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  runTransaction,
  writeBatch,
  setDoc,
  type DocumentReference,
  type QueryDocumentSnapshot,
  type Timestamp,
} from 'firebase/firestore';
import { firebaseApp } from './firebase';
import type { CanvasBlock, BlockType } from '../lib/canvasModel';

// Firestore instance
export const db = getFirestore(firebaseApp);

// Data models
export interface Project {
  name: string;
  // Firestore serverTimestamp resolves to Timestamp when read; during write it's a FieldValue.
  // We model it as Timestamp | null for initial fetch right after creation where latency could surface.
  dateCreated: Timestamp | null;
  mainContext: string;
}

export interface Idea {
  text: string;
  index: number; // ordering key, ascending
  isLiked: boolean;
  addtlText?: string;
  parentId?: string; // for hierarchical relationships
  rootId?: string; // top ancestor for grouping/queries
  depth?: number; // derived logical depth
  x?: number; // optional spatial fields for future use
  y?: number;
}

export interface Note {
  x: number;
  y: number;
  text: string;
}

export interface WithId<T> {
  id: string;
  data: T;
}

// Refs helpers
const userDocRef = (userId: string) => doc(db, 'users', userId);
const projectsColRef = (userId: string) => collection(userDocRef(userId), 'projects');
const projectDocRef = (userId: string, projectId: string) => doc(projectsColRef(userId), projectId);
const ideasColRef = (userId: string, projectId: string) => collection(projectDocRef(userId, projectId), 'ideas');
const ideaDocRef = (userId: string, projectId: string, ideaId: string) => doc(ideasColRef(userId, projectId), ideaId);
const notesColRef = (userId: string, projectId: string) => collection(projectDocRef(userId, projectId), 'notes');
const noteDocRef = (userId: string, projectId: string, noteId: string) => doc(notesColRef(userId, projectId), noteId);

// ----- User CRUD -----
export async function createUserDocument(userId: string, email: string): Promise<void> {
  await setDoc(userDocRef(userId), {
    email,
    createdAt: serverTimestamp(),
  });
}

// ----- Project CRUD -----
export async function createProject(
  userId: string,
  input: { name: string; mainContext: string }
): Promise<string> {
  const ref = await addDoc(projectsColRef(userId), {
    name: input.name,
    mainContext: input.mainContext,
    dateCreated: serverTimestamp(),
  });
  return ref.id;
}

type FirestoreProjectRaw = { name: string; mainContext: string; dateCreated?: Timestamp };

export async function listProjectsForUser(userId: string): Promise<WithId<Project>[]> {
  const q = query(projectsColRef(userId), orderBy('dateCreated', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as FirestoreProjectRaw;
    return {
      id: d.id,
      data: {
        name: data.name,
        mainContext: data.mainContext,
        dateCreated: data.dateCreated ?? null,
      },
    } satisfies WithId<Project>;
  });
}

export async function getProject(userId: string, projectId: string): Promise<WithId<Project> | null> {
  const d = await getDoc(projectDocRef(userId, projectId));
  if (!d.exists()) return null;
  const data = d.data() as FirestoreProjectRaw;
  return {
    id: d.id,
    data: {
      name: data.name,
      mainContext: data.mainContext,
      dateCreated: data.dateCreated ?? null,
    },
  } satisfies WithId<Project>;
}

export async function updateProject(
  userId: string,
  projectId: string,
  update: Partial<Pick<Project, 'name' | 'mainContext'>>
): Promise<void> {
  await updateDoc(projectDocRef(userId, projectId), update as Partial<Project>);
}

// Deletes project document only (keeps ideas). Prefer deleteProjectWithIdeas for full cleanup.
export async function deleteProject(userId: string, projectId: string): Promise<void> {
  await deleteDoc(projectDocRef(userId, projectId));
}

// Deletes all ideas under the project in batches, then deletes the project doc.
export async function deleteProjectWithIdeas(userId: string, projectId: string): Promise<void> {
  // Batch delete ideas in chunks (Firestore limit 500 ops per batch)
  let hasMore = true;
  while (hasMore) {
    const q = query(ideasColRef(userId, projectId), orderBy('index', 'asc'), limit(450));
    const snap = await getDocs(q);
    if (snap.empty) {
      hasMore = false;
      break;
    }
    const batch = writeBatch(db);
    snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
    hasMore = snap.size >= 450;
  }
  await deleteDoc(projectDocRef(userId, projectId));
}

// ----- Idea CRUD -----
export async function createIdea(
  userId: string,
  projectId: string,
  input: { text: string; addtlText?: string; parentId?: string; rootId?: string; depth?: number; x?: number; y?: number }
): Promise<string> {
  // compute next sequential index
  const q = query(ideasColRef(userId, projectId), orderBy('index', 'desc'), limit(1));
  const snap = await getDocs(q);
  const nextIndex = snap.empty ? 0 : ((snap.docs[0].data().index as number) + 1);

  const ref = await addDoc(ideasColRef(userId, projectId), {
    text: input.text,
    addtlText: input.addtlText ?? '',
    isLiked: false,
    index: nextIndex,
    ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
    ...(input.rootId !== undefined ? { rootId: input.rootId } : {}),
    ...(input.depth !== undefined ? { depth: input.depth } : {}),
    ...(input.x !== undefined ? { x: input.x } : {}),
    ...(input.y !== undefined ? { y: input.y } : {}),
  } satisfies Idea);
  return ref.id;
}

export async function listIdeasForProject(
  userId: string,
  projectId: string
): Promise<WithId<Idea>[]> {
  const q = query(ideasColRef(userId, projectId), orderBy('index', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, data: d.data() as Idea }));
}

export async function getIdea(
  userId: string,
  projectId: string,
  ideaId: string
): Promise<WithId<Idea> | null> {
  const d = await getDoc(ideaDocRef(userId, projectId, ideaId));
  if (!d.exists()) return null;
  return { id: d.id, data: d.data() as Idea };
}

export async function updateIdea(
  userId: string,
  projectId: string,
  ideaId: string,
  update: Partial<Pick<Idea, 'text' | 'addtlText' | 'index' | 'isLiked' | 'parentId' | 'rootId' | 'depth' | 'x' | 'y'>>
): Promise<void> {
  await updateDoc(ideaDocRef(userId, projectId, ideaId), update as Partial<Idea>);
}

export async function deleteIdea(userId: string, projectId: string, ideaId: string): Promise<void> {
  await deleteDoc(ideaDocRef(userId, projectId, ideaId));
}

export async function toggleIdeaLiked(userId: string, projectId: string, ideaId: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = ideaDocRef(userId, projectId, ideaId) as DocumentReference;
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Idea not found');
    const current = (snap as QueryDocumentSnapshot<Idea>).data().isLiked ?? false;
    tx.update(ref, { isLiked: !current });
  });
}

// Optional: set a specific index (e.g., for future reordering)
export async function setIdeaIndex(
  userId: string,
  projectId: string,
  ideaId: string,
  newIndex: number
): Promise<void> {
  await updateDoc(ideaDocRef(userId, projectId, ideaId), { index: newIndex });
}

// Create a CanvasBlock and its corresponding Idea in Firestore
export async function createCanvasBlockWithIdea(
  userId: string,
  projectId: string,
  blockType: BlockType,
  label: string,
  content?: string,
  parentId?: string,
  directionFromParent?: 'up' | 'down' | 'left' | 'right'
): Promise<CanvasBlock> {
  // Create the Idea in Firestore
  const ideaId = await createIdea(userId, projectId, {
    text: label,
    addtlText: content,
  });

  // Build the CanvasBlock, using the ideaId as the block id
  const block: CanvasBlock = {
    id: ideaId, // Link block id to Firestore idea id
    type: blockType,
    label,
    content,
    parentId,
    children: [],
    directionFromParent,
  };
  return block;
}

// ----- Note CRUD -----
export async function createNote(
  userId: string,
  projectId: string,
  input: { x: number; y: number; text: string }
): Promise<string> {
  const ref = await addDoc(notesColRef(userId, projectId), {
    x: input.x,
    y: input.y,
    text: input.text,
  } satisfies Note);
  return ref.id;
}

export async function listNotesForProject(
  userId: string,
  projectId: string
): Promise<WithId<Note>[]> {
  const snap = await getDocs(notesColRef(userId, projectId));
  return snap.docs.map((d) => ({ id: d.id, data: d.data() as Note }));
}

export async function getNote(
  userId: string,
  projectId: string,
  noteId: string
): Promise<WithId<Note> | null> {
  const d = await getDoc(noteDocRef(userId, projectId, noteId));
  if (!d.exists()) return null;
  return { id: d.id, data: d.data() as Note };
}

export async function updateNote(
  userId: string,
  projectId: string,
  noteId: string,
  update: Partial<Note>
): Promise<void> {
  await updateDoc(noteDocRef(userId, projectId, noteId), update as Partial<Note>);
}

export async function deleteNote(userId: string, projectId: string, noteId: string): Promise<void> {
  await deleteDoc(noteDocRef(userId, projectId, noteId));
}
