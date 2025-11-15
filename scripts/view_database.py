"""
Database Viewer Script
Displays missing persons, detections, and alerts from PostgreSQL database
Supports filtering by date, person, and risk level
"""
import sys
import argparse
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime, date

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from tabulate import tabulate
from src.face_recognition.database import MissingPersonDB, PostgresConfig

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)


class DatabaseViewer:
    """
    Database viewer for missing persons registry.
    Provides formatted display of tables with filtering options.
    """
    
    def __init__(self, config: Optional[PostgresConfig] = None):
        """
        Initialize database viewer with connection.
        
        Args:
            config: Optional PostgresConfig (reads from env if omitted)
        """
        try:
            self.db = MissingPersonDB(config)
            logger.info("[INFO] Database connection established")
        except Exception as e:
            logger.error(f"[ERROR] Failed to connect to database: {e}")
            raise
    
    def display_missing_persons(self, status: Optional[str] = None) -> None:
        """
        Display missing persons table in formatted format.
        
        Args:
            status: Optional status filter (ACTIVE, FOUND, CLOSED)
        """
        try:
            with self.db._get_conn() as conn:
                with conn.cursor() as cursor:
                    if status:
                        cursor.execute('''
                            SELECT id, name, age, gender, description, 
                                   reported_date, last_seen_location, status
                            FROM missing_persons
                            WHERE status = %s
                            ORDER BY reported_date DESC
                        ''', (status,))
                    else:
                        cursor.execute('''
                            SELECT id, name, age, gender, description, 
                                   reported_date, last_seen_location, status
                            FROM missing_persons
                            ORDER BY reported_date DESC
                        ''')
                    
                    rows = cursor.fetchall()
                    
                    if not rows:
                        print("\n[INFO] No missing persons found")
                        return
                    
                    # Format data for display
                    table_data = []
                    headers = ["ID", "Name", "Age", "Gender", "Description", 
                              "Reported Date", "Last Seen", "Status"]
                    
                    for row in rows:
                        # Truncate description if too long
                        description = row['description'] or ''
                        if len(description) > 50:
                            description = description[:47] + "..."
                        
                        # Format date
                        reported_date = row['reported_date']
                        if reported_date:
                            reported_date = reported_date.strftime("%Y-%m-%d %H:%M")
                        
                        table_data.append([
                            row['id'],
                            row['name'],
                            row['age'] or 'N/A',
                            row['gender'] or 'N/A',
                            description,
                            reported_date or 'N/A',
                            row['last_seen_location'] or 'N/A',
                            row['status'] or 'N/A'
                        ])
                    
                    print("\n" + "=" * 100)
                    print("MISSING PERSONS TABLE")
                    if status:
                        print(f"Filter: status = {status}")
                    print("=" * 100)
                    print(tabulate(table_data, headers=headers, tablefmt="grid"))
                    print(f"\nTotal records: {len(table_data)}")
                    
        except Exception as e:
            logger.error(f"[ERROR] Failed to display missing persons: {e}")
            raise
    
    def display_recent_detections(self, limit: int = 20, 
                                  person_id: Optional[int] = None,
                                  start_date: Optional[date] = None,
                                  end_date: Optional[date] = None) -> None:
        """
        Display recent detections (last N records).
        
        Args:
            limit: Maximum number of detections to display (default: 20)
            person_id: Optional filter by person ID
            start_date: Optional start date filter
            end_date: Optional end date filter
        """
        try:
            with self.db._get_conn() as conn:
                with conn.cursor() as cursor:
                    # Build query with filters
                    query = '''
                        SELECT d.id, d.person_id, mp.name as person_name,
                               d.detection_timestamp, d.location, d.confidence,
                               d.crowd_density, d.image_path, d.notes
                        FROM detections d
                        LEFT JOIN missing_persons mp ON d.person_id = mp.id
                        WHERE 1=1
                    '''
                    params = []
                    
                    if person_id:
                        query += " AND d.person_id = %s"
                        params.append(person_id)
                    
                    if start_date:
                        query += " AND d.detection_timestamp >= %s"
                        params.append(start_date)
                    
                    if end_date:
                        query += " AND d.detection_timestamp <= %s"
                        params.append(end_date)
                    
                    query += " ORDER BY d.detection_timestamp DESC LIMIT %s"
                    params.append(limit)
                    
                    cursor.execute(query, params)
                    rows = cursor.fetchall()
                    
                    if not rows:
                        print("\n[INFO] No detections found")
                        return
                    
                    # Format data for display
                    table_data = []
                    headers = ["ID", "Person ID", "Person Name", "Timestamp", 
                              "Location", "Confidence", "Crowd Density", "Image Path", "Notes"]
                    
                    for row in rows:
                        # Format timestamp
                        timestamp = row['detection_timestamp']
                        if timestamp:
                            timestamp = timestamp.strftime("%Y-%m-%d %H:%M:%S")
                        
                        # Format confidence as percentage
                        confidence = row['confidence']
                        if confidence is not None:
                            confidence = f"{confidence:.2%}"
                        else:
                            confidence = 'N/A'
                        
                        # Truncate long fields
                        location = row['location'] or ''
                        if len(location) > 30:
                            location = location[:27] + "..."
                        
                        image_path = row['image_path'] or ''
                        if len(image_path) > 30:
                            image_path = image_path[:27] + "..."
                        
                        notes = row['notes'] or ''
                        if len(notes) > 30:
                            notes = notes[:27] + "..."
                        
                        table_data.append([
                            row['id'],
                            row['person_id'] or 'N/A',
                            row['person_name'] or 'N/A',
                            timestamp or 'N/A',
                            location,
                            confidence,
                            row['crowd_density'] or 'N/A',
                            image_path,
                            notes
                        ])
                    
                    print("\n" + "=" * 120)
                    print(f"RECENT DETECTIONS (Last {len(table_data)})")
                    if person_id:
                        print(f"Filter: person_id = {person_id}")
                    if start_date:
                        print(f"Filter: start_date >= {start_date}")
                    if end_date:
                        print(f"Filter: end_date <= {end_date}")
                    print("=" * 120)
                    print(tabulate(table_data, headers=headers, tablefmt="grid"))
                    print(f"\nTotal records displayed: {len(table_data)}")
                    
        except Exception as e:
            logger.error(f"[ERROR] Failed to display detections: {e}")
            raise
    
    def display_alerts_by_risk_level(self, risk_level: Optional[str] = None,
                                     start_date: Optional[date] = None,
                                     end_date: Optional[date] = None) -> None:
        """
        Display alerts grouped by risk level.
        
        Args:
            risk_level: Optional filter by risk level (SAFE, WARNING, RISKY, CRITICAL)
            start_date: Optional start date filter
            end_date: Optional end date filter
        """
        try:
            with self.db._get_conn() as conn:
                with conn.cursor() as cursor:
                    # Build query with filters
                    query = '''
                        SELECT id, timestamp, alert_type, risk_level, 
                               person_count, message, location
                        FROM alert_logs
                        WHERE 1=1
                    '''
                    params = []
                    
                    if risk_level:
                        query += " AND risk_level = %s"
                        params.append(risk_level)
                    
                    if start_date:
                        query += " AND timestamp >= %s"
                        params.append(start_date)
                    
                    if end_date:
                        query += " AND timestamp <= %s"
                        params.append(end_date)
                    
                    query += " ORDER BY timestamp DESC"
                    
                    cursor.execute(query, params)
                    rows = cursor.fetchall()
                    
                    if not rows:
                        print("\n[INFO] No alerts found")
                        return
                    
                    # Group by risk level
                    alerts_by_level: Dict[str, List[Dict[str, Any]]] = {}
                    for row in rows:
                        level = row['risk_level'] or 'UNKNOWN'
                        if level not in alerts_by_level:
                            alerts_by_level[level] = []
                        alerts_by_level[level].append(dict(row))
                    
                    # Display each risk level
                    for level, alerts in sorted(alerts_by_level.items()):
                        print("\n" + "=" * 100)
                        print(f"ALERTS - RISK LEVEL: {level} (Count: {len(alerts)})")
                        print("=" * 100)
                        
                        # Format data for display
                        table_data = []
                        headers = ["ID", "Timestamp", "Alert Type", "Risk Level", 
                                  "Person Count", "Message", "Location"]
                        
                        for alert in alerts:
                            # Format timestamp
                            timestamp = alert['timestamp']
                            if timestamp:
                                timestamp = timestamp.strftime("%Y-%m-%d %H:%M:%S")
                            
                            # Truncate long fields
                            message = alert['message'] or ''
                            if len(message) > 40:
                                message = message[:37] + "..."
                            
                            location = alert['location'] or ''
                            if len(location) > 30:
                                location = location[:27] + "..."
                            
                            table_data.append([
                                alert['id'],
                                timestamp or 'N/A',
                                alert['alert_type'] or 'N/A',
                                alert['risk_level'] or 'N/A',
                                alert['person_count'] or 'N/A',
                                message,
                                location
                            ])
                        
                        print(tabulate(table_data, headers=headers, tablefmt="grid"))
                    
                    print(f"\nTotal alerts displayed: {len(rows)}")
                    
        except Exception as e:
            logger.error(f"[ERROR] Failed to display alerts: {e}")
            raise
    
    def display_statistics(self) -> None:
        """
        Display database statistics summary.
        """
        try:
            stats = self.db.get_statistics()
            
            print("\n" + "=" * 60)
            print("DATABASE STATISTICS SUMMARY")
            print("=" * 60)
            
            # Basic counts
            stats_table = [
                ["Active Missing Persons", stats.get('active_missing', 0)],
                ["Total Detections", stats.get('total_detections', 0)],
                ["Total Alerts", stats.get('total_alerts', 0)]
            ]
            
            print("\nOverview:")
            print(tabulate(stats_table, headers=["Metric", "Count"], tablefmt="grid"))
            
            # Alerts by level
            alerts_by_level = stats.get('alerts_by_level', {})
            if alerts_by_level:
                print("\nAlerts by Risk Level:")
                alerts_table = [[level, count] for level, count in sorted(alerts_by_level.items())]
                print(tabulate(alerts_table, headers=["Risk Level", "Count"], tablefmt="grid"))
            else:
                print("\nNo alerts by risk level data available")
            
            # Additional statistics
            with self.db._get_conn() as conn:
                with conn.cursor() as cursor:
                    # Get status breakdown
                    cursor.execute('''
                        SELECT status, COUNT(*) as count
                        FROM missing_persons
                        GROUP BY status
                    ''')
                    status_rows = cursor.fetchall()
                    
                    if status_rows:
                        print("\nMissing Persons by Status:")
                        status_table = [[row['status'], row['count']] for row in status_rows]
                        print(tabulate(status_table, headers=["Status", "Count"], tablefmt="grid"))
                    
                    # Get detection statistics
                    cursor.execute('''
                        SELECT 
                            COUNT(*) as total,
                            AVG(confidence) as avg_confidence,
                            MIN(detection_timestamp) as first_detection,
                            MAX(detection_timestamp) as last_detection
                        FROM detections
                    ''')
                    det_stats = cursor.fetchone()
                    
                    if det_stats and det_stats['total'] > 0:
                        print("\nDetection Statistics:")
                        det_table = [
                            ["Total Detections", det_stats['total']],
                            ["Average Confidence", f"{det_stats['avg_confidence']:.2%}" if det_stats['avg_confidence'] else 'N/A'],
                            ["First Detection", det_stats['first_detection'].strftime("%Y-%m-%d %H:%M:%S") if det_stats['first_detection'] else 'N/A'],
                            ["Last Detection", det_stats['last_detection'].strftime("%Y-%m-%d %H:%M:%S") if det_stats['last_detection'] else 'N/A']
                        ]
                        print(tabulate(det_table, headers=["Metric", "Value"], tablefmt="grid"))
            
            print("\n" + "=" * 60)
            
        except Exception as e:
            logger.error(f"[ERROR] Failed to display statistics: {e}")
            raise
    
    def close(self) -> None:
        """Close database connection."""
        try:
            self.db.close()
            logger.info("[INFO] Database connection closed")
        except Exception:
            pass


def parse_date(date_string: str) -> date:
    """
    Parse date string in YYYY-MM-DD format.
    
    Args:
        date_string: Date string to parse
    
    Returns:
        date: Parsed date object
    
    Raises:
        ValueError: If date format is invalid
    """
    try:
        return datetime.strptime(date_string, "%Y-%m-%d").date()
    except ValueError:
        raise ValueError(f"Invalid date format: {date_string}. Expected YYYY-MM-DD")


def main():
    """Main function for command-line interface."""
    parser = argparse.ArgumentParser(
        description="View missing persons database with filtering options",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Display all missing persons
  python scripts/view_database.py --missing-persons
  
  # Display active missing persons only
  python scripts/view_database.py --missing-persons --status ACTIVE
  
  # Display recent detections
  python scripts/view_database.py --detections --limit 20
  
  # Display detections for specific person
  python scripts/view_database.py --detections --person-id 1
  
  # Display alerts by risk level
  python scripts/view_database.py --alerts --risk-level CRITICAL
  
  # Display alerts filtered by date
  python scripts/view_database.py --alerts --start-date 2024-01-01 --end-date 2024-12-31
  
  # Display statistics
  python scripts/view_database.py --statistics
  
  # Display everything
  python scripts/view_database.py --all
        """
    )
    
    # Display options
    parser.add_argument(
        '--missing-persons', '-m',
        action='store_true',
        help='Display missing persons table'
    )
    parser.add_argument(
        '--detections', '-d',
        action='store_true',
        help='Display recent detections'
    )
    parser.add_argument(
        '--alerts', '-a',
        action='store_true',
        help='Display alerts by risk level'
    )
    parser.add_argument(
        '--statistics', '-s',
        action='store_true',
        help='Display statistics summary'
    )
    parser.add_argument(
        '--all',
        action='store_true',
        help='Display all information'
    )
    
    # Filtering options
    parser.add_argument(
        '--status',
        type=str,
        choices=['ACTIVE', 'FOUND', 'CLOSED'],
        help='Filter missing persons by status'
    )
    parser.add_argument(
        '--person-id',
        type=int,
        help='Filter detections by person ID'
    )
    parser.add_argument(
        '--risk-level',
        type=str,
        choices=['SAFE', 'WARNING', 'RISKY', 'CRITICAL'],
        help='Filter alerts by risk level'
    )
    parser.add_argument(
        '--limit',
        type=int,
        default=20,
        help='Limit number of detections to display (default: 20)'
    )
    parser.add_argument(
        '--start-date',
        type=str,
        help='Start date filter (YYYY-MM-DD)'
    )
    parser.add_argument(
        '--end-date',
        type=str,
        help='End date filter (YYYY-MM-DD)'
    )
    
    args = parser.parse_args()
    
    # If no specific option is selected, show all
    if not any([args.missing_persons, args.detections, args.alerts, args.statistics, args.all]):
        args.all = True
    
    # Parse dates if provided
    start_date = None
    end_date = None
    if args.start_date:
        try:
            start_date = parse_date(args.start_date)
        except ValueError as e:
            logger.error(f"[ERROR] {e}")
            return 1
    
    if args.end_date:
        try:
            end_date = parse_date(args.end_date)
        except ValueError as e:
            logger.error(f"[ERROR] {e}")
            return 1
    
    # Initialize viewer
    try:
        viewer = DatabaseViewer()
    except Exception as e:
        logger.error(f"[ERROR] Failed to initialize database viewer: {e}")
        return 1
    
    try:
        # Display requested information
        if args.all or args.missing_persons:
            viewer.display_missing_persons(status=args.status)
        
        if args.all or args.detections:
            viewer.display_recent_detections(
                limit=args.limit,
                person_id=args.person_id,
                start_date=start_date,
                end_date=end_date
            )
        
        if args.all or args.alerts:
            viewer.display_alerts_by_risk_level(
                risk_level=args.risk_level,
                start_date=start_date,
                end_date=end_date
            )
        
        if args.all or args.statistics:
            viewer.display_statistics()
        
        return 0
        
    except Exception as e:
        logger.error(f"[ERROR] Error displaying data: {e}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        viewer.close()


if __name__ == "__main__":
    sys.exit(main())

