import fitz
for team in ['sales','cs','lm','cc']:
 d=fitz.open(f'tmp/pdfs/weekly-{team}.pdf')
 print(team, len(d),'pages',[(i+1,len(p.get_text()),list(p.rect)) for i,p in enumerate(d)])
 sheet=fitz.open()
 for first in range(0,len(d),6):
  page=sheet.new_page(width=1200,height=900)
  for j in range(first,min(first+6,len(d))):
   x=((j-first)%2)*600;y=((j-first)//2)*300
   page.show_pdf_page(fitz.Rect(x,y,x+590,y+285),d,j)
  page.get_pixmap().save(f'tmp/pdfs/{team}-preview-{first//6}.png')
