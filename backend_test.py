#!/usr/bin/env python3
"""
Comprehensive Backend Testing for Taskora PWA
Tests both traditional API endpoints and local-first functionality
"""

import requests
import json
import time
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://freelance-tracker-10.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

class TaskoraBackendTester:
    def __init__(self):
        self.test_results = []
        self.failed_tests = []
        
    def log_test(self, test_name, success, message="", details=None):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "timestamp": datetime.now().isoformat(),
            "details": details
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}: {message}")
        
        if not success:
            self.failed_tests.append(test_name)
            if details:
                print(f"   Details: {details}")
    
    def test_api_root_endpoint(self):
        """Test the root API endpoint"""
        try:
            response = requests.get(f"{API_BASE}/root", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("message") == "Hello World":
                    self.log_test("API Root Endpoint", True, "Root endpoint responding correctly")
                    return True
                else:
                    self.log_test("API Root Endpoint", False, f"Unexpected response: {data}")
                    return False
            else:
                self.log_test("API Root Endpoint", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except requests.exceptions.RequestException as e:
            self.log_test("API Root Endpoint", False, f"Request failed: {str(e)}")
            return False
    
    def test_api_status_post(self):
        """Test POST /api/status endpoint"""
        try:
            test_data = {
                "client_name": f"test_client_{int(time.time())}"
            }
            
            response = requests.post(
                f"{API_BASE}/status", 
                json=test_data,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["id", "client_name", "timestamp"]
                
                if all(field in data for field in required_fields):
                    if data["client_name"] == test_data["client_name"]:
                        self.log_test("API Status POST", True, "Status creation successful")
                        return data
                    else:
                        self.log_test("API Status POST", False, "Client name mismatch in response")
                        return None
                else:
                    missing = [f for f in required_fields if f not in data]
                    self.log_test("API Status POST", False, f"Missing fields: {missing}")
                    return None
            else:
                self.log_test("API Status POST", False, f"HTTP {response.status_code}: {response.text}")
                return None
                
        except requests.exceptions.RequestException as e:
            self.log_test("API Status POST", False, f"Request failed: {str(e)}")
            return None
    
    def test_api_status_get(self):
        """Test GET /api/status endpoint"""
        try:
            response = requests.get(f"{API_BASE}/status", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                if isinstance(data, list):
                    self.log_test("API Status GET", True, f"Retrieved {len(data)} status records")
                    return data
                else:
                    self.log_test("API Status GET", False, f"Expected list, got: {type(data)}")
                    return None
            else:
                self.log_test("API Status GET", False, f"HTTP {response.status_code}: {response.text}")
                return None
                
        except requests.exceptions.RequestException as e:
            self.log_test("API Status GET", False, f"Request failed: {str(e)}")
            return None
    
    def test_api_status_validation(self):
        """Test API validation for status endpoint"""
        try:
            # Test missing client_name
            response = requests.post(
                f"{API_BASE}/status", 
                json={},
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            if response.status_code == 400:
                data = response.json()
                if "client_name is required" in data.get("error", ""):
                    self.log_test("API Status Validation", True, "Validation working correctly")
                    return True
                else:
                    self.log_test("API Status Validation", False, f"Unexpected error message: {data}")
                    return False
            else:
                self.log_test("API Status Validation", False, f"Expected 400, got {response.status_code}")
                return False
                
        except requests.exceptions.RequestException as e:
            self.log_test("API Status Validation", False, f"Request failed: {str(e)}")
            return False
    
    def test_api_cors_headers(self):
        """Test CORS headers are present"""
        try:
            response = requests.options(f"{API_BASE}/status", timeout=10)
            
            cors_headers = [
                'Access-Control-Allow-Origin',
                'Access-Control-Allow-Methods',
                'Access-Control-Allow-Headers'
            ]
            
            missing_headers = []
            for header in cors_headers:
                if header not in response.headers:
                    missing_headers.append(header)
            
            if not missing_headers:
                self.log_test("API CORS Headers", True, "All CORS headers present")
                return True
            else:
                self.log_test("API CORS Headers", False, f"Missing headers: {missing_headers}")
                return False
                
        except requests.exceptions.RequestException as e:
            self.log_test("API CORS Headers", False, f"Request failed: {str(e)}")
            return False
    
    def test_api_404_handling(self):
        """Test 404 handling for non-existent routes"""
        try:
            response = requests.get(f"{API_BASE}/nonexistent", timeout=10)
            
            if response.status_code == 404:
                data = response.json()
                if "not found" in data.get("error", "").lower():
                    self.log_test("API 404 Handling", True, "404 errors handled correctly")
                    return True
                else:
                    self.log_test("API 404 Handling", False, f"Unexpected 404 message: {data}")
                    return False
            else:
                self.log_test("API 404 Handling", False, f"Expected 404, got {response.status_code}")
                return False
                
        except requests.exceptions.RequestException as e:
            self.log_test("API 404 Handling", False, f"Request failed: {str(e)}")
            return False
    
    def test_pwa_manifest(self):
        """Test PWA manifest accessibility"""
        try:
            response = requests.get(f"{BASE_URL}/manifest.json", timeout=10)
            
            if response.status_code == 200:
                try:
                    manifest = response.json()
                    required_fields = ["name", "short_name", "start_url", "display", "icons"]
                    
                    missing_fields = [f for f in required_fields if f not in manifest]
                    if not missing_fields:
                        self.log_test("PWA Manifest", True, "Manifest accessible and valid")
                        return True
                    else:
                        self.log_test("PWA Manifest", False, f"Missing fields: {missing_fields}")
                        return False
                except json.JSONDecodeError:
                    self.log_test("PWA Manifest", False, "Invalid JSON in manifest")
                    return False
            else:
                self.log_test("PWA Manifest", False, f"HTTP {response.status_code}")
                return False
                
        except requests.exceptions.RequestException as e:
            self.log_test("PWA Manifest", False, f"Request failed: {str(e)}")
            return False
    
    def test_service_worker(self):
        """Test service worker accessibility"""
        try:
            response = requests.get(f"{BASE_URL}/sw.js", timeout=10)
            
            if response.status_code == 200:
                content = response.text
                # Check for key service worker features
                sw_features = [
                    "addEventListener('install'",
                    "addEventListener('activate'",
                    "addEventListener('fetch'",
                    "caches.open"
                ]
                
                missing_features = []
                for feature in sw_features:
                    if feature not in content:
                        missing_features.append(feature)
                
                if not missing_features:
                    self.log_test("Service Worker", True, "Service worker accessible and contains key features")
                    return True
                else:
                    self.log_test("Service Worker", False, f"Missing features: {missing_features}")
                    return False
            else:
                self.log_test("Service Worker", False, f"HTTP {response.status_code}")
                return False
                
        except requests.exceptions.RequestException as e:
            self.log_test("Service Worker", False, f"Request failed: {str(e)}")
            return False
    
    def test_app_accessibility(self):
        """Test main app accessibility"""
        try:
            response = requests.get(BASE_URL, timeout=10)
            
            if response.status_code == 200:
                content = response.text
                # Check for key app elements
                app_elements = [
                    "<html",
                    "<head",
                    "<body",
                    "Taskora"  # App name should be present
                ]
                
                missing_elements = []
                for element in app_elements:
                    if element not in content:
                        missing_elements.append(element)
                
                if not missing_elements:
                    self.log_test("App Accessibility", True, "Main app accessible")
                    return True
                else:
                    self.log_test("App Accessibility", False, f"Missing elements: {missing_elements}")
                    return False
            else:
                self.log_test("App Accessibility", False, f"HTTP {response.status_code}")
                return False
                
        except requests.exceptions.RequestException as e:
            self.log_test("App Accessibility", False, f"Request failed: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting Taskora Backend Tests")
        print("=" * 50)
        
        # Test traditional API endpoints
        print("\n📡 Testing Traditional API Endpoints:")
        self.test_api_root_endpoint()
        self.test_api_status_post()
        self.test_api_status_get()
        self.test_api_status_validation()
        self.test_api_cors_headers()
        self.test_api_404_handling()
        
        # Test PWA functionality
        print("\n📱 Testing PWA Functionality:")
        self.test_pwa_manifest()
        self.test_service_worker()
        self.test_app_accessibility()
        
        # Summary
        print("\n" + "=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        
        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if r["success"]])
        failed_tests = len(self.failed_tests)
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if self.failed_tests:
            print(f"\n❌ Failed Tests:")
            for test in self.failed_tests:
                print(f"  - {test}")
        else:
            print(f"\n🎉 All tests passed!")
        
        return failed_tests == 0

if __name__ == "__main__":
    tester = TaskoraBackendTester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)