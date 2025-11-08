import requests
import sys
import json
from datetime import datetime
import time

class LocationSharingAPITester:
    def __init__(self, base_url="https://liveshare-bot.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })

    def test_api_root(self):
        """Test API root endpoint"""
        try:
            response = requests.get(f"{self.api_url}/", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}, Response: {response.text[:100]}"
            self.log_test("API Root Endpoint", success, details)
            return success
        except Exception as e:
            self.log_test("API Root Endpoint", False, str(e))
            return False

    def test_share_location(self):
        """Test location sharing endpoint"""
        test_location = {
            "latitude": 28.6139,
            "longitude": 77.209,
            "accuracy": 10.0
        }
        
        try:
            response = requests.post(
                f"{self.api_url}/location/share",
                json=test_location,
                headers={'Content-Type': 'application/json'},
                timeout=15  # Increased timeout for Telegram API call
            )
            
            success = response.status_code == 200
            if success:
                data = response.json()
                required_fields = ['id', 'latitude', 'longitude', 'timestamp']
                missing_fields = [field for field in required_fields if field not in data]
                if missing_fields:
                    success = False
                    details = f"Missing fields: {missing_fields}"
                else:
                    details = f"Location shared successfully. ID: {data.get('id', 'N/A')}"
            else:
                details = f"Status: {response.status_code}, Response: {response.text[:200]}"
            
            self.log_test("Share Location to Backend & Telegram", success, details)
            return success, response.json() if success else {}
            
        except Exception as e:
            self.log_test("Share Location to Backend & Telegram", False, str(e))
            return False, {}

    def test_get_locations(self):
        """Test getting location history"""
        try:
            response = requests.get(f"{self.api_url}/locations", timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                if isinstance(data, list):
                    details = f"Retrieved {len(data)} locations"
                    if len(data) > 0:
                        # Check if location has required fields
                        first_loc = data[0]
                        required_fields = ['id', 'latitude', 'longitude', 'timestamp']
                        missing_fields = [field for field in required_fields if field not in first_loc]
                        if missing_fields:
                            success = False
                            details = f"Location missing fields: {missing_fields}"
                else:
                    success = False
                    details = "Response is not a list"
            else:
                details = f"Status: {response.status_code}, Response: {response.text[:200]}"
            
            self.log_test("Get Location History", success, details)
            return success, response.json() if success else []
            
        except Exception as e:
            self.log_test("Get Location History", False, str(e))
            return False, []

    def test_clear_locations(self):
        """Test clearing location history"""
        try:
            response = requests.delete(f"{self.api_url}/locations", timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                details = f"Deleted {data.get('deleted_count', 0)} locations"
            else:
                details = f"Status: {response.status_code}, Response: {response.text[:200]}"
            
            self.log_test("Clear Location History", success, details)
            return success
            
        except Exception as e:
            self.log_test("Clear Location History", False, str(e))
            return False

    def test_multiple_location_shares(self):
        """Test sharing multiple locations to verify Telegram integration"""
        locations = [
            {"latitude": 28.6139, "longitude": 77.209, "accuracy": 10.0},
            {"latitude": 28.6140, "longitude": 77.210, "accuracy": 15.0},
            {"latitude": 28.6141, "longitude": 77.211, "accuracy": 12.0}
        ]
        
        successful_shares = 0
        for i, location in enumerate(locations):
            try:
                response = requests.post(
                    f"{self.api_url}/location/share",
                    json=location,
                    headers={'Content-Type': 'application/json'},
                    timeout=15
                )
                if response.status_code == 200:
                    successful_shares += 1
                    print(f"  Location {i+1}/3 shared successfully")
                else:
                    print(f"  Location {i+1}/3 failed: {response.status_code}")
                
                # Small delay between requests
                time.sleep(1)
                
            except Exception as e:
                print(f"  Location {i+1}/3 failed: {str(e)}")
        
        success = successful_shares == len(locations)
        details = f"Successfully shared {successful_shares}/{len(locations)} locations"
        self.log_test("Multiple Location Shares", success, details)
        return success

    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting Location Sharing API Tests...")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)
        
        # Test API availability
        if not self.test_api_root():
            print("❌ API is not accessible. Stopping tests.")
            return False
        
        # Test location sharing (includes Telegram integration)
        success, shared_location = self.test_share_location()
        if not success:
            print("❌ Location sharing failed. This is critical functionality.")
        
        # Test getting locations
        self.test_get_locations()
        
        # Test multiple location shares to verify Telegram bot
        self.test_multiple_location_shares()
        
        # Test clearing locations
        self.test_clear_locations()
        
        # Verify locations were cleared
        success, locations = self.test_get_locations()
        if success and len(locations) == 0:
            print("✅ Location clearing verified")
        elif success:
            print(f"⚠️  Warning: {len(locations)} locations still exist after clearing")
        
        print("=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All backend tests passed!")
        else:
            print("⚠️  Some backend tests failed. Check details above.")
        
        return self.tests_passed == self.tests_run

def main():
    tester = LocationSharingAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump({
            'summary': {
                'total_tests': tester.tests_run,
                'passed_tests': tester.tests_passed,
                'success_rate': f"{(tester.tests_passed/tester.tests_run*100):.1f}%" if tester.tests_run > 0 else "0%",
                'timestamp': datetime.now().isoformat()
            },
            'detailed_results': tester.test_results
        }, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())