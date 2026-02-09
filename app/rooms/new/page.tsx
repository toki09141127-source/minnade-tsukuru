import { redirect } from 'next/navigation'

export default function RoomsNewRedirectPage() {
  redirect('/rooms/create')
}
