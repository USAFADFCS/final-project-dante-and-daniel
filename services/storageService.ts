import { WorkoutLog } from '../types';

const STORAGE_KEY = 'fitcoach_master_log';

export const getWorkoutLogs = (): WorkoutLog[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (e) {
    console.error("Failed to parse workout logs", e);
    return [];
  }
};

// Helper to get local date string YYYY-MM-DD
const getLocalTodayDate = (): string => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const saveWorkoutLog = (logData: WorkoutLog): { updatedLogs: WorkoutLog[], wasMerged: boolean } => {
  const currentLogs = getWorkoutLogs();
  
  // Determine target date: Use provided date or fallback to local today
  const targetDate = logData.date || getLocalTodayDate();
  
  // Check for existing log with the same date
  const existingLogIndex = currentLogs.findIndex(l => l.date === targetDate);

  if (existingLogIndex >= 0) {
    // --- MERGE LOGIC ---
    const existingLog = currentLogs[existingLogIndex];
    
    // Concatenate duration if both exist
    let newDuration = existingLog.duration;
    if (logData.duration) {
        newDuration = existingLog.duration 
            ? `${existingLog.duration} + ${logData.duration}`
            : logData.duration;
    }

    // Concatenate notes
    let newNotes = existingLog.notes;
    if (logData.notes) {
        newNotes = existingLog.notes
            ? `${existingLog.notes}\n---\n${logData.notes}`
            : logData.notes;
    }

    // Determine workout type (upgrade to mixed if different)
    const newType = (existingLog.workout_type !== logData.workout_type && logData.workout_type !== 'mixed') 
        ? 'mixed' 
        : existingLog.workout_type;

    const mergedLog: WorkoutLog = {
        ...existingLog,
        exercises: [...existingLog.exercises, ...logData.exercises],
        duration: newDuration,
        notes: newNotes,
        workout_type: newType,
        timestamp: Date.now() // Update timestamp to bring to top
    };

    // Replace existing log and re-sort (Move merged log to top)
    const otherLogs = currentLogs.filter((_, idx) => idx !== existingLogIndex);
    const updatedLogs = [mergedLog, ...otherLogs];
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLogs));
    return { updatedLogs, wasMerged: true };

  } else {
    // --- INSERT NEW LOGIC ---
    const newLog = {
        ...logData,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        date: targetDate
    };

    const updatedLogs = [newLog, ...currentLogs]; // Newest first
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLogs));
    return { updatedLogs, wasMerged: false };
  }
};

export const clearLogs = () => {
  localStorage.removeItem(STORAGE_KEY);
};