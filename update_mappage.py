import re

with open("frontend/src/pages/MapPage.tsx", "r") as f:
    content = f.read()

# Change buildingId to building_id
content = content.replace("const { buildingId } = useParams<{ buildingId: string }>();", "const { building_id } = useParams<{ building_id: string }>();")

# Replace the loadData block
old_loadData = """  useEffect(() => {
    async function loadData() {
      if (!buildingId) {
        setIsLoading(false);
        setLoadError('No building ID provided.');
        return;
      }
      setIsLoading(true);
      setLoadError(null);
      try {
        const data = await getBuilding(buildingId);
        if (data) {
          setBuilding(data);
          if (data.units?.length > 0) setSelectedUnit(data.units[0]);
        } else {
          setLoadError(`Building "${buildingId}" not found.`);
        }
      } catch (err: any) {
        const msg = err?.response?.data?.detail || err?.message || 'Failed to load building data.';
        setLoadError(msg);
        console.error('MapPage loadData error:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [buildingId]);"""

new_loadData = """  useEffect(() => {
    async function loadData() {
      if (!building_id) {
        setIsLoading(false);
        setLoadError('No building ID provided.');
        return;
      }
      setIsLoading(true);
      setLoadError(null);
      try {
        // Use direct axios call as specified
        const axios = (await import('axios')).default;
        const response = await axios.get(`/api/v1/buildings/${building_id}`);
        const data = response.data;
        if (data) {
          setBuilding(data);
          if (data.units?.length > 0) setSelectedUnit(data.units[0]);
        } else {
          setLoadError(`Building "${building_id}" not found.`);
        }
      } catch (err: any) {
        const msg = err?.response?.data?.detail || err?.message || 'Failed to load building data.';
        setLoadError(msg);
        console.error('MapPage loadData error:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [building_id]);"""

content = content.replace(old_loadData, new_loadData)
content = content.replace("getBuilding(buildingId)", "getBuilding(building_id)")

with open("frontend/src/pages/MapPage.tsx", "w") as f:
    f.write(content)
