from db import firestore_db as fdb

categories = [
    {
        'slug': 'electronics',
        'name': 'Electronics',
        'description': 'Laptops, calculators, cameras and more',
        'icon': 'fa-laptop',
        'color': '#6366f1',
    },
    {
        'slug': 'textbooks',
        'name': 'Textbooks',
        'description': 'Academic books and study material',
        'icon': 'fa-book',
        'color': '#0ea5e9',
    },
    {
        'slug': 'tools',
        'name': 'Tools',
        'description': 'Lab equipment, tools and instruments',
        'icon': 'fa-wrench',
        'color': '#f59e0b',
    },
    {
        'slug': 'clothing',
        'name': 'Clothing',
        'description': 'Formal wear, lab coats, sports gear',
        'icon': 'fa-tshirt',
        'color': '#10b981',
    },
]

for cat in categories:
    fdb.collection('categories').document(cat['slug']).set(cat)
    print(f"Added category: {cat['name']}")

print("Seed complete!")
