import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import PptxGenJS from 'pptxgenjs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
  }

  try {
    const supabaseAdmin = createAdminClient();

    // Fetch project
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Fetch items with photos
    const { data: items } = await supabaseAdmin
      .from('items')
      .select('*, photos(*)')
      .eq('project_id', projectId)
      .order('order_index', { ascending: true });

    // Generate PPTX
    const pptx = new PptxGenJS();
    pptx.title = `${project.name} - Report`;
    pptx.author = 'EMS System';
    pptx.company = 'Optimum Production';

    // Cover slide
    const coverSlide = pptx.addSlide();
    coverSlide.background = { color: '1F4E79' };
    coverSlide.addText('Event Monitoring System', {
      x: 0.5,
      y: 1.5,
      w: '90%',
      h: 1,
      fontSize: 36,
      color: 'FFFFFF',
      bold: true,
      align: 'center',
    });
    coverSlide.addText(project.name, {
      x: 0.5,
      y: 2.5,
      w: '90%',
      h: 1,
      fontSize: 28,
      color: 'FFFFFF',
      align: 'center',
    });
    if (project.client_name) {
      coverSlide.addText(project.client_name, {
        x: 0.5,
        y: 3.5,
        w: '90%',
        h: 0.75,
        fontSize: 18,
        color: 'FFFFFF',
        align: 'center',
      });
    }

    // Slides for each item
    (items || []).forEach(item => {
      const slide = pptx.addSlide();
      slide.addText(item.name, {
        x: 0.5,
        y: 0.5,
        w: '90%',
        h: 0.75,
        fontSize: 24,
        bold: true,
      });

      if (item.description) {
        slide.addText(item.description, {
          x: 0.5,
          y: 1.25,
          w: '90%',
          h: 0.5,
          fontSize: 14,
          color: '666666',
        });
      }

      // Add photos
      const photos = item.photos || [];
      if (photos.length > 0) {
        slide.addText('Foto:', {
          x: 0.5,
          y: 2,
          w: '90%',
          h: 0.4,
          fontSize: 14,
          bold: true,
        });

        // Simple text for photos (since we don't have direct image data from drive)
        photos.forEach((photo, index) => {
          slide.addText(
            `${index + 1}. ${photo.caption || 'Foto'} - ${photo.status}`,
            {
              x: 0.75,
              y: 2.3 + index * 0.3,
              w: '85%',
              h: 0.3,
              fontSize: 12,
            }
          );
        });
      }
    });

    // Generate buffer
    const buffer = await pptx.write({ outputType: 'arraybuffer' });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_report.pptx"`,
      },
    });
  } catch (error: any) {
    console.error('Error generating PPTX:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
