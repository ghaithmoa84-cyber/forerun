import { redirect } from 'next/navigation';

export default function BannersRedirectPage() {
  redirect('/dashboard/banners');
}
