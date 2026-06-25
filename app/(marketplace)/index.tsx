import { useAuth } from '@/contexts/AuthContext';
import CustomerHome from '@/components/marketplace/home/CustomerHome';
import VendorHome from '@/components/marketplace/home/VendorHome';
import AdminHome from '@/components/marketplace/home/AdminHome';
import { LoadingScreen } from '@/components/LoadingScreen';

export default function HomeScreen() {
  const { profile } = useAuth();

  if (!profile) {
    return <LoadingScreen />;
  }

  if (profile.role === 'vendor') {
    return <VendorHome />;
  }

  if (profile.role === 'admin') {
    return <AdminHome />;
  }

  return <CustomerHome />;
}
