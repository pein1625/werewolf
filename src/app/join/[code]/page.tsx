import { redirect } from 'next/navigation'

export default async function JoinRedirect({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  redirect(`/play/${code.toUpperCase()}`)
}
