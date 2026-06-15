import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../../core/models.dart';

final myBookingsProvider = FutureProvider.family<List<Booking>, String?>((ref, status) async {
  final params = <String, dynamic>{'page': '1', 'perPage': '20'};
  if (status != null) params['status'] = status;
  return ref.read(apiClientProvider).get(
        '/bookings',
        (d) => (d as List).map((b) => Booking.fromJson(b as Map<String, dynamic>)).toList(),
        params: params,
      );
});

final bookingDetailProvider = FutureProvider.family<Booking, String>((ref, id) async {
  return ref.read(apiClientProvider).get('/bookings/$id', (d) => Booking.fromJson(d as Map<String, dynamic>));
});
