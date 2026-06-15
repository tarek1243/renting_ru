import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../app.dart';
import '../../core/api_client.dart';
import '../../core/models.dart';
import '../auth/auth_provider.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final authAsync = ref.watch(authProvider);
    final locale = ref.watch(localeProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l.profile),
        actions: [
          TextButton.icon(
            icon: const Icon(Icons.language_outlined, size: 18),
            label: Text(locale.languageCode.toUpperCase()),
            onPressed: () => ref.read(localeProvider.notifier).state = locale.languageCode == 'en' ? const Locale('ar') : const Locale('en'),
          ),
        ],
      ),
      body: authAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => const Center(child: Text('Not logged in')),
        data: (user) {
          if (user == null) {
            WidgetsBinding.instance.addPostFrameCallback((_) => context.go('/login'));
            return const SizedBox();
          }
          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              _UserCard(user: user),
              const SizedBox(height: 20),
              _LicenseCard(user: user),
              const SizedBox(height: 20),
              _MenuSection(tiles: [
                _MenuTile(Icons.favorite_outline, 'Favorites', () {}),
                _MenuTile(Icons.notifications_outlined, l.notifications, () {}),
              ]),
              const SizedBox(height: 12),
              _MenuSection(tiles: [
                _MenuTile(Icons.logout_outlined, l.logout, () async {
                  await ref.read(authProvider.notifier).logout();
                  if (context.mounted) context.go('/login');
                }, danger: true),
              ]),
            ],
          );
        },
      ),
    );
  }
}

class _UserCard extends StatelessWidget {
  final User user;
  const _UserCard({required this.user});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Row(
          children: [
            CircleAvatar(
              radius: 30,
              backgroundColor: const Color(0xFFEFF6FF),
              child: Text(user.name.isNotEmpty ? user.name[0].toUpperCase() : '?', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: Color(0xFF2563EB))),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(user.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 17)),
                  Text(user.email, style: const TextStyle(color: Color(0xFF6B7280), fontSize: 13)),
                  if (user.phone != null) Text(user.phone!, style: const TextStyle(color: Color(0xFF6B7280), fontSize: 13)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LicenseCard extends ConsumerStatefulWidget {
  final User user;
  const _LicenseCard({required this.user});

  @override
  ConsumerState<_LicenseCard> createState() => _LicenseCardState();
}

class _LicenseCardState extends ConsumerState<_LicenseCard> {
  final Map<String, Color> _statusColors = {
    'approved': const Color(0xFF16A34A),
    'pending': const Color(0xFFD97706),
    'rejected': const Color(0xFFDC2626),
  };

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final status = widget.user.licenseStatus;
    final color = _statusColors[status] ?? const Color(0xFF6B7280);
    final statusLabel = status == null ? l.notVerified : status == 'approved' ? l.approved : status == 'pending' ? l.pending : l.rejected;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(l.licenseStatus, style: const TextStyle(fontWeight: FontWeight.w600)),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(20)),
                  child: Text(statusLabel, style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: 12)),
                ),
              ],
            ),
            if (status == null || status == 'rejected') ...[
              const SizedBox(height: 12),
              ElevatedButton.icon(
                icon: const Icon(Icons.upload_outlined, size: 18),
                label: Text(l.uploadLicense),
                onPressed: () => _showUploadSheet(context),
                style: ElevatedButton.styleFrom(minimumSize: const Size(double.infinity, 44)),
              ),
            ],
          ],
        ),
      ),
    );
  }

  void _showUploadSheet(BuildContext context) {
    final numCtrl = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(context).viewInsets.bottom + 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Upload license', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 16),
            TextField(controller: numCtrl, decoration: const InputDecoration(labelText: 'License number', prefixIcon: Icon(Icons.badge_outlined))),
            const SizedBox(height: 16),
            const Text('• Front image and back image upload would use image_picker + POST /media/presign', style: TextStyle(color: Color(0xFF6B7280), fontSize: 13)),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () async {
                if (numCtrl.text.trim().isEmpty) return;
                try {
                  await ref.read(apiClientProvider).post('/licenses/upload', (_) => null, body: {
                    'licenseNumber': numCtrl.text.trim(),
                    'expiresAt': '2028-01-01',
                    'frontImageKey': 'licenses/placeholder-front.jpg',
                    'backImageKey': 'licenses/placeholder-back.jpg',
                  });
                  if (context.mounted) {
                    Navigator.pop(context);
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('License submitted for review!')));
                    ref.invalidate(authProvider);
                  }
                } catch (e) {
                  if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
                }
              },
              child: const Text('Submit'),
            ),
          ],
        ),
      ),
    );
  }
}

class _MenuSection extends StatelessWidget {
  final List<_MenuTile> tiles;
  const _MenuSection({required this.tiles});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Column(
        children: tiles.map((t) {
          final isLast = t == tiles.last;
          return Column(
            children: [
              ListTile(
                leading: Icon(t.icon, color: t.danger ? const Color(0xFFDC2626) : null),
                title: Text(t.label, style: TextStyle(color: t.danger ? const Color(0xFFDC2626) : null)),
                trailing: const Icon(Icons.chevron_right, color: Color(0xFFD1D5DB)),
                onTap: t.onTap,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              if (!isLast) const Divider(height: 1, indent: 56),
            ],
          );
        }).toList(),
      ),
    );
  }
}

class _MenuTile {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool danger;
  const _MenuTile(this.icon, this.label, this.onTap, {this.danger = false});
}
