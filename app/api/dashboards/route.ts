import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { z } from 'zod'

const createDashboardSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().url(),
})

// GET /api/dashboards - List all dashboards for the authenticated user
export async function GET() {
  try {
    const supabase = createSupabaseServerClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: dashboards, error } = await supabase
      .from('dashboards')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching dashboards:', error)
      return NextResponse.json(
        { error: 'Failed to fetch dashboards' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: dashboards })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/dashboards - Create a new dashboard
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validatedData = createDashboardSchema.parse(body)

    const { data: dashboard, error } = await supabase
      .from('dashboards')
      .insert({
        ...validatedData,
        user_id: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating dashboard:', error)
      return NextResponse.json(
        { error: 'Failed to create dashboard' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { data: dashboard },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Validation failed',
        details: error.errors
      }, { status: 400 })
    }

    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}