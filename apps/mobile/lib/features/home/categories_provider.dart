import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../../core/models.dart';

final categoriesProvider = FutureProvider<List<Category>>((ref) async {
  return ref.read(apiClientProvider).get(
        '/categories',
        (d) => (d as List).map((c) => Category.fromJson(c as Map<String, dynamic>)).toList(),
      );
});
