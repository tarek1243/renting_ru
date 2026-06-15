import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'features/auth/auth_provider.dart';
import 'features/auth/login_screen.dart';
import 'features/auth/register_screen.dart';
import 'features/home/home_screen.dart';
import 'features/browse/category_screen.dart';
import 'features/browse/listing_detail_screen.dart';
import 'features/booking/booking_flow_screen.dart';
import 'features/booking/confirmation_screen.dart';
import 'features/profile/profile_screen.dart';
import 'features/profile/my_bookings_screen.dart';
import 'features/profile/booking_detail_screen.dart';

final _rootNav = GlobalKey<NavigatorState>(debugLabel: 'root');
final _shellNav = GlobalKey<NavigatorState>(debugLabel: 'shell');

final routerProvider = Provider<GoRouter>((ref) {
  final authAsync = ref.watch(authProvider);

  return GoRouter(
    navigatorKey: _rootNav,
    initialLocation: '/home',
    redirect: (_, state) {
      if (authAsync.isLoading) return null;
      final authed = authAsync.valueOrNull != null;
      final path = state.matchedLocation;
      final isAuthPath = path == '/login' || path == '/register';
      if (!authed && !isAuthPath) return '/login';
      if (authed && isAuthPath) return '/home';
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/register', builder: (_, __) => const RegisterScreen()),
      GoRoute(
        path: '/book/:listingId',
        parentNavigatorKey: _rootNav,
        builder: (_, s) => BookingFlowScreen(listingId: s.pathParameters['listingId']!),
      ),
      GoRoute(
        path: '/booking-confirmation/:bookingId',
        parentNavigatorKey: _rootNav,
        builder: (_, s) => ConfirmationScreen(bookingId: s.pathParameters['bookingId']!),
      ),
      ShellRoute(
        navigatorKey: _shellNav,
        builder: (_, state, child) => HomeShell(location: state.matchedLocation, child: child),
        routes: [
          GoRoute(path: '/home', builder: (_, __) => const HomeTab()),
          GoRoute(
            path: '/category/:slug',
            builder: (_, s) => CategoryScreen(slug: s.pathParameters['slug']!),
            routes: [
              GoRoute(
                path: 'listing/:listingSlug',
                parentNavigatorKey: _rootNav,
                builder: (_, s) => ListingDetailScreen(
                  categorySlug: s.pathParameters['slug']!,
                  listingSlug: s.pathParameters['listingSlug']!,
                ),
              ),
            ],
          ),
          GoRoute(path: '/bookings', builder: (_, __) => const MyBookingsScreen()),
          GoRoute(
            path: '/bookings/:id',
            parentNavigatorKey: _rootNav,
            builder: (_, s) => BookingDetailScreen(bookingId: s.pathParameters['id']!),
          ),
          GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
        ],
      ),
    ],
  );
});
