import React from 'react';
import { WorkoutLog, Exercise } from '../types';

interface LogDashboardProps {
  logs: WorkoutLog[];
}

const LogDashboard: React.FC<LogDashboardProps> = ({ logs }) => {
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
        <p className="text-center">No workouts logged yet.</p>
        <p className="text-sm text-gray-600 mt-2">Try saying "I did 3 sets of squats at 225lbs"</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 pb-24">
      <h2 className="text-2xl font-bold text-neon-green tracking-wide border-b border-gray-800 pb-2">Master Log</h2>
      {logs.map((log) => (
        <div key={log.id} className="bg-gray-800 rounded-xl p-5 border border-gray-700 hover:border-neon-blue transition-colors shadow-lg">
          <div className="flex justify-between items-start mb-3">
            <div>
              <span className="inline-block px-2 py-1 text-xs font-bold uppercase rounded bg-gray-700 text-neon-blue mr-2">
                {log.workout_type}
              </span>
              <span className="text-gray-400 text-sm">{log.date}</span>
            </div>
            {log.duration && (
              <span className="text-xs text-gray-400 flex items-center">
                 <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                 {log.duration}
              </span>
            )}
          </div>

          <div className="space-y-3">
            {log.exercises.map((ex: Exercise, idx: number) => (
              <div key={idx} className="bg-gray-900/50 rounded-lg p-3">
                <h4 className="font-semibold text-gray-200 mb-1">{ex.name}</h4>
                <div className="grid grid-cols-4 gap-2 text-xs text-gray-500 uppercase font-bold mb-1">
                    <span>Set</span>
                    <span>Reps</span>
                    <span>Weight</span>
                    <span>RPE/RIR</span>
                </div>
                {ex.sets.map((set, sIdx) => (
                  <div key={sIdx} className="grid grid-cols-4 gap-2 text-sm text-gray-300 border-t border-gray-800 pt-1 mt-1">
                    <span>#{set.set_number}</span>
                    <span>{set.reps}</span>
                    <span>{set.weight || '-'}</span>
                    <span>{set.reps_in_reserve !== null ? set.reps_in_reserve : '-'}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {log.notes && (
            <div className="mt-3 pt-3 border-t border-gray-700 text-sm text-gray-400 italic">
              "{log.notes}"
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default LogDashboard;