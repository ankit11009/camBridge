import unittest
from detect import filter_people

class PersonZoneTests(unittest.TestCase):
    def setUp(self):
        self.zone = {'x': 0, 'y': 0, 'width': .5, 'height': 1}
        self.shape = (100, 100, 3)

    def test_inside_person(self):
        result = filter_people([[10, 10, 30, 80, .9, 0]], self.shape, self.zone)
        self.assertEqual(result[0]['label'], 'person')
        self.assertEqual(result[0]['confidence'], .9)

    def test_outside_and_overlapping_person(self):
        # Box overlaps zone, but feet remain outside.
        self.assertEqual(filter_people([[40, 10, 90, 80, .9, 0]], self.shape, self.zone), [])

    def test_non_person_and_low_confidence(self):
        self.assertEqual(filter_people([[10, 10, 30, 80, .9, 2], [10, 10, 30, 80, .3, 0]], self.shape), [])

    def test_zone_boundary_and_empty_frame(self):
        self.assertEqual(len(filter_people([[40, 10, 60, 80, .8, 0]], self.shape, self.zone)), 1)
        self.assertEqual(filter_people([], self.shape), [])

if __name__ == '__main__':
    unittest.main()
