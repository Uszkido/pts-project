import Foundation
import CoreLocation
import CoreBluetooth

class SentinelLocationManager: NSObject, ObservableObject, CLLocationManagerDelegate, CBCentralManagerDelegate {
    
    private let locationManager = CLLocationManager()
    private var bluetoothManager: CBCentralManager!
    
    @Published var currentLocation: CLLocation?
    var isLostMode: Bool = false
    
    // API Endpoint for Sentinel Platform
    private let backendURL = URL(string: "https://pts-backend-main-project.onrender.com/api/v1/guardian/beacon")!

    override init() {
        super.init()
        
        // 1. Initialize CoreLocation
        locationManager.delegate = self
        locationManager.allowsBackgroundLocationUpdates = true
        locationManager.pausesLocationUpdatesAutomatically = false // Crucial for Lost Mode
        
        // 2. Initialize Bluetooth for deep pinpointing
        bluetoothManager = CBCentralManager(delegate: self, queue: nil)
    }
    
    func startGuarding(lost: Bool) {
        self.isLostMode = lost
        locationManager.requestAlwaysAuthorization()
        
        if isLostMode {
            // Aggressive tracking logic
            locationManager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
            locationManager.distanceFilter = 5 // Update every 5 meters
        } else {
            // Battery Saver Mode
            locationManager.desiredAccuracy = kCLLocationAccuracyHundredMeters
            locationManager.distanceFilter = 50 // Update every 50 meters
        }
        
        locationManager.startUpdatingLocation()
        // locationManager.startMonitoringSignificantLocationChanges() // Geofencing fallback
    }
    
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        self.currentLocation = location
        
        print("Sentinel [iOS] Fix: \(location.coordinate.latitude), \(location.coordinate.longitude)")
        transmitToBackend(location: location)
    }
    
    func transmitToBackend(location: CLLocation) {
        var request = URLRequest(url: backendURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let payload: [String: Any] = [
            "latitude": location.coordinate.latitude,
            "longitude": location.coordinate.longitude,
            "accuracy": location.horizontalAccuracy,
            "altitude": location.altitude,
            "speed": location.speed,
            "status": isLostMode ? "LOST" : "ONLINE"
        ]
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: payload, options: [])
            
            URLSession.shared.dataTask(with: request) { data, response, error in
                if let error = error {
                    print("Network failure. Trigger offline sync / Silent SMS: \(error.localizedDescription)")
                    return
                }
                print("Sentinel [iOS] Sync Successful")
            }.resume()
            
        } catch {
            print("Payload creation failed.")
        }
    }
    
    // CoreBluetooth Delegate (For short-range precision)
    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        if central.state == .poweredOn {
            // In lost mode, we could ping BLE beacons around us to refine indoor positioning 
            // bluetoothManager.scanForPeripherals(withServices: nil, options: nil)
        }
    }
}
