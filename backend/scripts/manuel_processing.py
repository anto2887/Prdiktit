#!/usr/bin/env python3
"""
Manual script to run match and prediction processing
Use this for testing or manual processing runs
"""

import sys
import os

# Add backend to Python path
backend_path = os.path.join(os.path.dirname(__file__), '..')
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.services.match_processor import MatchProcessor
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

def main():
    """Main function"""
    print("🔄 Starting manual match processing...")
    
    try:
        processor = MatchProcessor()
        
        print("\n1️⃣ Checking processing status...")
        completed_matches = processor.get_completed_matches()
        upcoming_matches = processor.get_upcoming_matches_for_locking()
        
        print(f"   📊 Found {len(completed_matches)} completed matches needing processing")
        print(f"   🔒 Found {len(upcoming_matches)} matches ready for prediction locking")
        
        if len(upcoming_matches) > 0:
            print("\n2️⃣ Locking predictions for matches at kickoff...")
            locking_result = processor.run_prediction_locking()
            print(f"   ✅ Locked predictions for {locking_result.get('matches_processed', 0)} matches")
            print(f"   📝 Total predictions locked: {locking_result.get('predictions_locked', 0)}")
        
        if len(completed_matches) > 0:
            print("\n3️⃣ Processing completed matches...")
            processing_result = processor.run_match_processing()
            print(f"   ✅ Processed {processing_result.get('matches_completed', 0)} completed matches")
            print(f"   🎯 Total predictions processed: {processing_result.get('predictions_processed', 0)}")
        
        if len(completed_matches) == 0 and len(upcoming_matches) == 0:
            print("\n✨ No processing needed - all matches and predictions are up to date!")
        
        print("\n🎉 Manual processing complete!")
        
    except Exception as e:
        print(f"\n❌ Error during processing: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()