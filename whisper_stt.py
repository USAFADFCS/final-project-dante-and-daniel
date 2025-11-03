from faster_whisper import WhisperModel
import sys
import json
import requests

def transcribe_audio(audio_file_path, model_size="base"):
    """
    Transcribe audio file to text using faster-whisper.
    
    Args:
        audio_file_path: Path to the audio file
        model_size: Whisper model size (tiny, base, small, medium, large-v2, large-v3)
    
    Returns:
        Transcription text
    """
    print(f"Loading Whisper {model_size} model...")
    model = WhisperModel(model_size, device="cpu", compute_type="int8")
    
    print(f"Transcribing {audio_file_path}...")
    segments, info = model.transcribe(audio_file_path, beam_size=5)
    
    print(f"Detected language: {info.language} (probability: {info.language_probability:.2f})")
    
    transcription = " ".join([segment.text for segment in segments])
    
    return transcription

def extract_workout_data(transcription, model_name="llama3.2"):
    """
    Use local Ollama LLM to extract structured workout data from transcription.
    
    Args:
        transcription: The transcribed text
        model_name: Ollama model to use (llama3.2, mistral, etc.)
    
    Returns:
        Structured workout data as dict
    """
    print(f"\nExtracting workout data with local LLM ({model_name})...")
    
    prompt = f"""Extract structured workout data from the following transcription. 
Return a JSON object with this structure:
{{
    "exercises": [
        {{
            "name": "exercise name",
            "sets": [
                {{
                    "set_number": 1,
                    "reps": number,
                    "weight": "weight with units" or null,
                    "reps_in_reserve": number or null,
                    "notes": "set-specific notes" or null
                }}
            ]
        }}
    ],
    "workout_type": "strength/cardio/mixed",
    "duration": "total time if mentioned",
    "date": "date if mentioned",
    "notes": "general workout notes"
}}

Each set should be a separate object in the sets array with its own weight, reps, RIR (reps in reserve), and notes.

Important: 
- If the transcription mentions "to failure", "until failure", "failed", or similar phrases, set reps_in_reserve to 0.
- If the transcription mentions "X reps in reserve", "X RIR", "X in the tank", or similar, extract that number for reps_in_reserve.
- Do NOT include RIR/failure information in the notes field since it's captured in reps_in_reserve.
- Notes should only contain other relevant information like how the exercise felt, form cues, or other observations.

Transcription: {transcription}

Return ONLY valid JSON, no other text."""

    try:
        response = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": model_name,
                "prompt": prompt,
                "stream": False,
                "format": "json"
            },
            timeout=120
        )
        
        response.raise_for_status()
        result = response.json()
        
        # Parse the JSON response from the model
        workout_data = json.loads(result["response"])
        return workout_data
        
    except requests.exceptions.ConnectionError:
        print("\nError: Could not connect to Ollama.")
        print("Make sure Ollama is running: ollama serve")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"\nError parsing JSON response: {e}")
        print(f"Raw response: {result.get('response', 'N/A')}")
        sys.exit(1)

def append_to_master_log(workout_data, master_log_path="workout_master_log.json", date_override=None):
    """
    Append workout data to the master log file.
    Each day is its own workout - exercises from the same day are merged.
    
    Args:
        workout_data: Structured workout data dict
        master_log_path: Path to master log JSON file
        date_override: Optional date string (YYYY-MM-DD) for testing or backfilling
    """
    from datetime import datetime
    
    # Get today's date or use override
    if date_override:
        today = date_override
    else:
        today = datetime.now().date().isoformat()
    
    # Force the date override on workout_data
    workout_data["date"] = today
    
    # Load existing log or create new one
    try:
        with open(master_log_path, 'r', encoding='utf-8') as f:
            master_log = json.load(f)
    except FileNotFoundError:
        master_log = {"workouts": []}
    
    # Find if there's already a workout for today
    existing_workout = None
    for workout in master_log["workouts"]:
        workout_date = workout.get("date", "")
        # Handle both date-only and datetime formats
        if workout_date.startswith(today):
            existing_workout = workout
            break
    
    if existing_workout:
        # Merge exercises into existing workout
        existing_workout["exercises"].extend(workout_data["exercises"])
        
        # Update workout type if it changes
        if workout_data.get("workout_type") and workout_data["workout_type"] != existing_workout.get("workout_type"):
            existing_workout["workout_type"] = "mixed"
        
        # Append notes if new ones exist
        if workout_data.get("notes"):
            existing_notes = existing_workout.get("notes", "")
            if existing_notes:
                existing_workout["notes"] = f"{existing_notes}; {workout_data['notes']}"
            else:
                existing_workout["notes"] = workout_data["notes"]
        
        print(f"\nExercises merged into workout for {today}")
    else:
        # Create new workout for the specified date
        workout_data["date"] = today
        master_log["workouts"].append(workout_data)
        print(f"\nNew workout created for {today}")
    
    # Save updated log
    with open(master_log_path, 'w', encoding='utf-8') as f:
        json.dump(master_log, f, indent=2)
    
    print(f"Master log updated: {master_log_path}")
    print(f"Total workouts in log: {len(master_log['workouts'])}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python whisper_stt.py <audio_file> [whisper_model] [ollama_model] [master_log_path] [date_override]")
        print("\nWhisper models: tiny, base, small, medium, large-v2, large-v3")
        print("Ollama models: llama3.2, mistral, llama3.1, etc.")
        print("Date override: YYYY-MM-DD format for testing or backfilling")
        print("\nExamples:")
        print("  python whisper_stt.py workout.mp3")
        print("  python whisper_stt.py workout.mp3 base llama3.2")
        print("  python whisper_stt.py workout.mp3 base llama3.2 my_workouts.json")
        print("  python whisper_stt.py workout.mp3 base llama3.2 my_workouts.json 2025-11-01")
        sys.exit(1)
    
    audio_file = sys.argv[1]
    whisper_model = sys.argv[2] if len(sys.argv) > 2 else "base"
    ollama_model = sys.argv[3] if len(sys.argv) > 3 else "llama3.2"
    master_log_path = sys.argv[4] if len(sys.argv) > 4 else "workout_master_log.json"
    date_override = sys.argv[5] if len(sys.argv) > 5 else None
    
    try:
        # Step 1: Transcribe audio
        transcription = transcribe_audio(audio_file, whisper_model)
        print("\n--- Transcription ---")
        print(transcription)
        
        # Step 2: Extract workout data
        workout_data = extract_workout_data(transcription, ollama_model)
        print("\n--- Structured Workout Data ---")
        print(json.dumps(workout_data, indent=2))
        
        # Step 3: Save individual workout file
        base_name = audio_file.rsplit('.', 1)[0]
        
        # Save transcription
        transcription_file = f"{base_name}_transcription.txt"
        with open(transcription_file, 'w', encoding='utf-8') as f:
            f.write(transcription)
        print(f"\nTranscription saved to: {transcription_file}")
        
        # Save workout data
        workout_file = f"{base_name}_workout.json"
        with open(workout_file, 'w', encoding='utf-8') as f:
            json.dump(workout_data, f, indent=2)
        print(f"Workout data saved to: {workout_file}")
        
        # Step 4: Append to master log
        append_to_master_log(workout_data, master_log_path, date_override)
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)