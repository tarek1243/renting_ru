# Renting — Flutter Mobile App

## Setup (one-time)

**1. Install Flutter SDK**
https://docs.flutter.dev/get-started/install

**2. Create the Flutter project shell** (generates android/, ios/, test/)
```bash
cd apps/mobile
flutter create . --project-name renting_mobile --org com.renting
```
Flutter will not overwrite existing files in `lib/`.

**3. Set your API URL**

Open `lib/core/api_client.dart` and replace the `defaultValue`:
```dart
const _baseUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'https://YOUR_API_SERVICE.up.railway.app/api/v1',
);
```

**4. Install dependencies**
```bash
flutter pub get
```

**5. Run**
```bash
flutter run
```

---

## Project structure

```
lib/
├── main.dart                      # Entry point
├── app.dart                       # MaterialApp + theme + localization
├── router.dart                    # GoRouter with auth redirect
├── core/
│   ├── api_client.dart            # Dio HTTP client + token refresh interceptor
│   ├── models.dart                # All data classes (User, Listing, Booking, etc.)
│   ├── token_storage.dart         # SecureStorage for JWT tokens
│   └── theme.dart                 # App colors and component styles
├── l10n/
│   ├── app_en.arb                 # English strings
│   └── app_ar.arb                 # Arabic strings (RTL)
└── features/
    ├── auth/
    │   ├── auth_provider.dart     # Riverpod AsyncNotifier — login/register/logout
    │   ├── login_screen.dart
    │   └── register_screen.dart
    ├── home/
    │   ├── categories_provider.dart
    │   └── home_screen.dart       # HomeShell (bottom nav) + HomeTab
    ├── browse/
    │   ├── listings_provider.dart # FutureProvider.family with filters
    │   ├── category_screen.dart   # Search, filter sheet, listing grid
    │   └── listing_detail_screen.dart
    ├── booking/
    │   ├── booking_flow_screen.dart  # 3-step: dates → extras → review & pay
    │   ├── booking_provider.dart
    │   └── confirmation_screen.dart
    └── profile/
        ├── profile_screen.dart       # User card, license status, logout
        ├── my_bookings_screen.dart   # Booking list with status filter
        └── booking_detail_screen.dart # Cancel, review, detail
```

---

## Key packages

| Package | Purpose |
|---|---|
| `flutter_riverpod` | State management |
| `dio` | HTTP client with auth interceptor |
| `go_router` | Navigation with auth guard |
| `flutter_secure_storage` | JWT token storage |
| `cached_network_image` | Listing photos |
| `table_calendar` | Date picker for bookings |

---

## Language switching

Tap the language icon in the top-right on Home or Profile to switch EN ↔ AR.
Arabic automatically applies RTL layout via Flutter's `Directionality`.
