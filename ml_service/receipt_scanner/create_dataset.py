import csv
import os

# Define file path for our training dataset
DATASET_PATH = os.path.join(os.path.dirname(__file__), "receipt_dataset.csv")

# Structured training dataset containing diverse Indian receipt items and their categories
RAW_DATA = [
    # --- Groceries / Staples ---
    ("Fortune Sunlite Refined Sunflower Oil 1L", "Groceries"),
    ("Aashirvaad Shuddh Chakki Atta 5kg", "Groceries"),
    ("Tata Salt Vacuum Evaporated Iodised Salt 1kg", "Groceries"),
    ("Madhur Pure & Hygienic Sugar 1kg", "Groceries"),
    ("Daawat Rozana Super Basmati Rice 5kg", "Groceries"),
    ("Tata Sampann Unpolished Toor Dal 1kg", "Groceries"),
    ("Catch Turmeric Powder Haldi 100g", "Groceries"),
    ("Everest Tikhalal Red Chilli Powder 100g", "Groceries"),
    ("Maggi 2-Minute Masala Noodles 280g", "Groceries"),
    ("Saffola Gold Refined Cooking Oil 5L", "Groceries"),
    ("Organic Certified Beetroot (Beet)", "Groceries"),
    ("Gooseberry (Amla)", "Groceries"),
    ("Red Flesh Dragon Fruit Indian", "Groceries"),
    ("Green Chilli (Hirwi Mirchi)", "Groceries"),
    ("Green Cucumber (Kakadi)", "Groceries"),
    ("Nagpur Brinjal (Vange)", "Groceries"),
    ("Potato (Batate) Fresh", "Groceries"),
    ("Fresh Tomato Hybrid 1kg", "Groceries"),
    ("Amul Gold Pasteurised Full Cream Milk 500ml", "Groceries"),
    ("Mother Dairy Classic Curd Dahi 400g", "Groceries"),
    ("Amul Butter Pasteurised 100g", "Groceries"),
    ("Britannia 100% Whole Wheat Bread 400g", "Groceries"),
    
    # --- Personal Care & Beauty ---
    ("Dove Cream Beauty Bathing Bar Soap 75g", "Personal Care"),
    ("Head & Shoulders Anti Dandruff Shampoo 180ml", "Personal Care"),
    ("Colgate Strong Teeth Toothpaste 150g", "Personal Care"),
    ("Nivea Soft Light Moisturiser Cream 100ml", "Personal Care"),
    ("Dettol Original Liquid Handwash Refill 1500ml", "Personal Care"),
    ("Gillette Mach3 Turbo Razor Blades", "Personal Care"),
    ("Pond's Bright Beauty Face Wash 100g", "Personal Care"),
    ("Wild Stone Code Titanium Body Spray 120ml", "Personal Care"),
    ("L'Oreal Paris Total Repair 5 Conditioner", "Personal Care"),
    ("Sensodyne Rapid Relief Toothpaste 80g", "Personal Care"),
    ("Fiama Gel Bathing Bar Soap Pack", "Personal Care"),
    ("Vaseline Intensive Care Body Lotion 400ml", "Personal Care"),

    # --- Medicines & Healthcare ---
    ("Crocin Advance 650mg Paracetamol Tablet", "Medicine"),
    ("Dolo 650mg Fever Reducer Tablet", "Medicine"),
    ("Vicks Vaporub Cold Relief 50g", "Medicine"),
    ("Combiflam Pain Relief Tablet Pack", "Medicine"),
    ("Volini Pain Relief Spray 100g", "Medicine"),
    ("Revital H Daily Health Supplement Capsules", "Medicine"),
    ("Benadryl Cough Syrup 100ml", "Medicine"),
    ("Becosules Z Multivitamin Capsules Pack", "Medicine"),
    ("Saridon Headache Relief Tablets", "Medicine"),
    ("Digene Acidity Relief Gel Syrup 200ml", "Medicine"),
    ("Moov Instant Pain Relief Cream 50g", "Medicine"),
    ("Band-Aid First Aid Adhesive Bandages", "Medicine"),

    # --- Electronics & Gadgets ---
    ("Apple iPhone 15 128GB Blue", "Electronics"),
    ("Samsung Galaxy S24 Ultra Smartphone", "Electronics"),
    ("Logitech MX Master 3S Wireless Mouse", "Electronics"),
    ("Boat Airdopes 141 TWS Earbuds", "Electronics"),
    ("Sony WH-1000XM5 Wireless Headphones", "Electronics"),
    ("SanDisk Ultra 64GB Micro SD Card", "Electronics"),
    ("Dell 65W Laptop Power Charger Adapter", "Electronics"),
    ("HP Wireless Keyboard and Mouse Combo", "Electronics"),
    ("OnePlus Nord CE 3 Lite 5G Mobile", "Electronics"),
    ("Realme 10000mAh Fast Power Bank", "Electronics"),
    ("TP-Link AC1200 Wi-Fi Router", "Electronics"),
    ("Mi Smart Band 8 Fitness Tracker", "Electronics"),

    # --- Dining & Fast Food ---
    ("Starbucks Iced Velvet Vanilla Latte", "Dining"),
    ("Dominos Cheesy Margherita Large Pizza", "Dining"),
    ("McDonald's McChicken Burger Combo", "Dining"),
    ("KFC Hot & Crispy Chicken Bucket", "Dining"),
    ("Subway Paneer Tikka 6 Inch Sub", "Dining"),
    ("Burger King Veg Whopper Meal", "Dining"),
    ("Pizza Hut Pepperoni Pizza Large", "Dining"),
    ("Baskin Robbins Chocolate Ice Cream Scoop", "Dining"),
    ("Chai Point Masala Tea 500ml Flask", "Dining"),
    ("Haldiram's Raj Kachori Plate", "Dining"),
    ("Swiggy Restaurant Food Delivery Order", "Dining"),
    ("Zomato Online Dinner Order", "Dining"),

    # --- Transportation & Travel ---
    ("Uber Premier Ride Airport Drop", "Transportation"),
    ("Ola Auto Booking City Travel", "Transportation"),
    ("HPCL Petrol Fuel Refill 20 Litres", "Transportation"),
    ("IndiGo Airline Flight Ticket Mumbai to Delhi", "Transportation"),
    ("BPCL Diesel Fuel Refill 30 Litres", "Transportation"),
    ("Rapido Bike Taxi Local Ride", "Transportation"),
    ("IRCTC Indian Railways Train Ticket", "Transportation"),
    ("FASTag Toll Plaza Automatic Payment", "Transportation"),
    ("Uber Go City Taxi Trip", "Transportation"),
    ("Shell Premium Petrol Fuel Fill", "Transportation"),
    ("RedBus Intercity Bus Ticket Booking", "Transportation"),
    ("Air India Flight Pass Ticket", "Transportation"),

    # --- Utilities & Subscriptions ---
    ("MSEDCL Electricity Power Bill Payment", "Utilities"),
    ("Tata Play DTH Recharge Super Family Pack", "Utilities"),
    ("Jio Fiber Broadband Monthly Internet Bill", "Utilities"),
    ("Airtel Postpaid Mobile Bill Payment", "Utilities"),
    ("Adani Electricity Monthly Power Bill", "Utilities"),
    ("Mahanagar Gas Piped PNG Bill", "Utilities"),
    ("Airtel Digital TV DTH Monthly Recharge", "Utilities"),
    ("BSNL Landline Broadband Bill", "Utilities"),

    # --- Entertainment ---
    ("Netflix Premium 4K Ultra HD Plan", "Entertainment"),
    ("Spotify Premium Annual Subscription", "Entertainment"),
    ("YouTube Premium Family Monthly Plan", "Entertainment"),
    ("BookMyShow Movie Ticket PVR Cinemas", "Entertainment"),
    ("Amazon Prime Video Annual Membership", "Entertainment"),
    ("Disney+ Hotstar Premium Subscription", "Entertainment"),
    ("Apple Music Monthly Student Plan", "Entertainment"),
    ("Sony LIV Premium Annual Pass", "Entertainment")
]

def generate_csv():
    with open(DATASET_PATH, mode='w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(["item_name", "category"])
        writer.writerows(RAW_DATA)
    print(f"[SUCCESS] Training dataset saved to: '{DATASET_PATH}' with {len(RAW_DATA)} sample items!")

if __name__ == "__main__":
    generate_csv()
