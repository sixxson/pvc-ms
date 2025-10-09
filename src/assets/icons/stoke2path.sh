mkdir -p _output

for i in *.svg
do
   inkscape --actions="select-all;selection-ungroup;select-all;selection-ungroup;select-all;object-stroke-to-path;" --export-filename=- $i > _output/$i
   echo "done with "$i
done