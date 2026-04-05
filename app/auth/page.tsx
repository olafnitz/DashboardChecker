'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        router.push('/')
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) throw error
        setError('✅ Konto erstellt! Bitte überprüfen Sie Ihre E-Mails und klicken Sie auf den Bestätigungslink, um sich anzumelden. (Hinweis: In der Entwicklung kann die E-Mail-Bestätigung deaktiviert sein)')
      }
    } catch (error: any) {
      console.error('Auth error:', error)
      let message = error.message || 'An error occurred during authentication'
      
      // Provide more helpful error messages
      if (message === 'Invalid login credentials') {
        message = isLogin 
          ? 'Ungültige E-Mail oder Passwort. Stellen Sie sicher, dass Ihr Konto bestätigt wurde.'
          : 'Konto konnte nicht erstellt werden. Bitte versuchen Sie es erneut.'
      }
      
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Development Mode Banner */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-4 p-3 bg-[#eef2ff] border border-[#c7d2fe] rounded-[8px]">
            <p className="text-sm text-slate-800">
              <strong>Entwicklungsmodus:</strong> E-Mail-Bestätigungen können erforderlich sein.
              <a
                href="https://supabase.com/dashboard/project/qmdpjxnnlqcznohfrafp/auth/settings"
                target="_blank"
                rel="noopener noreferrer"
                className="underline ml-1 text-[#4F46E5] hover:text-[#4338CA] font-medium"
              >
                In Supabase-Einstellungen deaktivieren
              </a>
            </p>
          </div>
        )}
        <div className="card-base p-8">
          <div>
            <h2 className="text-center text-3xl font-bold text-slate-950">
              {isLogin ? 'Melden Sie sich in Ihrem Konto an' : 'Erstellen Sie Ihr Konto'}
            </h2>
            <p className="mt-2 text-center text-sm text-slate-600">
              {isLogin
                ? 'Geben Sie Ihre Zugangsdaten ein, um auf Ihr Dashboard zuzugreifen'
                : 'Erstellen Sie ein Konto, um mit der Überwachung Ihrer Dashboards zu beginnen'
              }
            </p>
            {isLogin && (
              <p className="mt-4 text-center text-xs text-slate-500">
                Sie haben noch kein Konto?{' '}
                <button
                  type="button"
                  onClick={() => setIsLogin(false)}
                  className="text-[#4F46E5] hover:text-[#4338CA] font-semibold"
                >
                  Hier registrieren
                </button>
              </p>
            )}
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-2">
                  E-Mail-Adresse
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="block w-full rounded-[8px] border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 placeholder-slate-500 focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20 sm:text-sm"
                  placeholder="E-Mail-Adresse"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-2">
                  Passwort
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  required
                  className="block w-full rounded-[8px] border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 placeholder-slate-500 focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20 sm:text-sm"
                  placeholder="Passwort"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="text-rose-600 text-sm text-center">
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full text-sm font-semibold disabled:opacity-50"
              >
                {loading ? 'Wird geladen...' : (isLogin ? 'Anmelden' : 'Registrieren')}
              </button>
            </div>

            <div className="text-center text-sm text-slate-600">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-[#4F46E5] hover:text-[#4338CA] font-semibold"
              >
                {isLogin ? "Noch kein Konto? Registrieren" : 'Bereits ein Konto? Anmelden'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}